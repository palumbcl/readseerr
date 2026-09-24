import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendDiscordIssueNotification } from "@/lib/discord";
import { getKomgaSeriesUrl } from "@/lib/komga";
import { findMediaLibrarySeries, upsertMedia } from "@/lib/media";
import { sendIssueUpdateEmail } from "@/lib/notifications";
import { resolveRole } from "@/lib/roles";
import type { CurrentUser } from "@/lib/permissions";
import {
  ISSUE_TYPE_LABELS,
  type IssueDetail,
  type IssueRecord,
  type IssueStatus,
  type IssueType,
  type MediaType,
  type RequestPayload,
} from "@/lib/types";

export const ISSUE_TYPES = Object.keys(ISSUE_TYPE_LABELS) as IssueType[];
const MAX_MESSAGE = 2000;

const issueInclude = {
  media: true,
  user: { select: { id: true, name: true, email: true, ntfyTopic: true } },
  resolvedBy: { select: { name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.IssueInclude;

type IssueRow = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;

function toRecord(issue: IssueRow): IssueRecord {
  return {
    id: issue.id,
    type: issue.type as IssueType,
    volume: issue.volume,
    message: issue.message,
    status: issue.status as IssueStatus,
    createdAt: issue.createdAt.toISOString(),
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    media: {
      mediaType: issue.media.mediaType as MediaType,
      externalId: issue.media.externalId,
      title: issue.media.title,
      coverUrl: issue.media.coverUrl,
    },
    user: { name: issue.user.name },
    resolvedBy: issue.resolvedBy,
    commentCount: issue._count.comments,
  };
}

export function cleanMessage(message: unknown): string | null {
  if (typeof message !== "string") return null;
  const trimmed = message.trim().slice(0, MAX_MESSAGE);
  return trimmed || null;
}

export async function createIssue(
  user: CurrentUser,
  payload: RequestPayload & { type: IssueType; volume?: number | null; message: string }
): Promise<IssueRecord> {
  const media = await upsertMedia(payload);
  const issue = await prisma.issue.create({
    data: {
      mediaId: media.id,
      userId: user.id,
      type: payload.type,
      volume: payload.volume && Number.isInteger(payload.volume) && payload.volume > 0 ? payload.volume : null,
      message: payload.message,
    },
    include: issueInclude,
  });

  await sendDiscordIssueNotification({
    kind: "new",
    title: media.title,
    mediaType: media.mediaType as MediaType,
    coverUrl: media.coverUrl,
    typeLabel: ISSUE_TYPE_LABELS[payload.type],
    volume: issue.volume,
    message: issue.message,
    userName: user.name || user.email,
    issueId: issue.id,
  });

  return toRecord(issue);
}

/** Signalements de l'utilisateur, ou de tous (admin), filtrés par statut. */
export async function listIssues({
  userId,
  status,
}: {
  userId?: string;
  status?: IssueStatus;
}): Promise<{ issues: IssueRecord[]; counts: Record<IssueStatus, number> }> {
  const scope = userId ? { userId } : {};
  const [rows, grouped] = await Promise.all([
    prisma.issue.findMany({
      where: { ...scope, ...(status && { status }) },
      include: issueInclude,
      orderBy: { createdAt: status === "open" ? "asc" : "desc" },
      take: 100,
    }),
    prisma.issue.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);

  const counts: Record<IssueStatus, number> = { open: 0, resolved: 0 };
  for (const group of grouped) {
    if (group.status === "open" || group.status === "resolved") counts[group.status] = group._count;
  }
  return { issues: rows.map(toRecord), counts };
}

/** Signalement lisible par son auteur et par les admins ; null sinon. */
async function getAccessibleIssue(user: CurrentUser, id: string): Promise<IssueRow | null> {
  const issue = await prisma.issue.findUnique({ where: { id }, include: issueInclude });
  if (!issue) return null;
  return issue.userId === user.id || user.role === "admin" ? issue : null;
}

export async function getIssueDetail(user: CurrentUser, id: string): Promise<IssueDetail | null> {
  const issue = await getAccessibleIssue(user, id);
  if (!issue) return null;

  const [comments, series] = await Promise.all([
    prisma.issueComment.findMany({
      where: { issueId: id },
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "asc" },
    }),
    findMediaLibrarySeries(issue.media),
  ]);

  return {
    ...toRecord(issue),
    comments: comments.map((c) => ({
      id: c.id,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
      user: { name: c.user.name, isAdmin: resolveRole(c.user.role, c.user.email) === "admin" },
    })),
    libraryUrl: series ? getKomgaSeriesUrl(series.id) : null,
    canManage: true,
  };
}

/**
 * Ajoute un message à la discussion. L'admin qui répond prévient l'auteur par email ;
 * l'auteur qui répond prévient l'admin sur Discord.
 */
export async function addIssueComment(user: CurrentUser, id: string, message: string): Promise<boolean> {
  const issue = await getAccessibleIssue(user, id);
  if (!issue) return false;

  await prisma.issueComment.create({ data: { issueId: id, userId: user.id, message } });
  await prisma.issue.update({ where: { id }, data: { updatedAt: new Date() } });

  if (user.id !== issue.userId) {
    await sendIssueUpdateEmail({ kind: "comment", user: issue.user, title: issue.media.title, issueId: id, message });
  } else {
    await sendDiscordIssueNotification({
      kind: "comment",
      title: issue.media.title,
      mediaType: issue.media.mediaType as MediaType,
      coverUrl: issue.media.coverUrl,
      typeLabel: ISSUE_TYPE_LABELS[issue.type as IssueType] ?? issue.type,
      volume: issue.volume,
      message,
      userName: user.name || user.email,
      issueId: id,
    });
  }
  return true;
}

/** Résout ou rouvre un signalement (auteur ou admin). */
export async function setIssueStatus(user: CurrentUser, id: string, status: IssueStatus): Promise<boolean> {
  const issue = await getAccessibleIssue(user, id);
  if (!issue) return false;
  if (issue.status === status) return true;

  await prisma.issue.update({
    where: { id },
    data:
      status === "resolved"
        ? { status, resolvedAt: new Date(), resolvedById: user.id }
        : { status, resolvedAt: null, resolvedById: null },
  });

  // L'auteur qui clôt lui-même son signalement n'a pas besoin d'email
  if (user.id !== issue.userId) {
    await sendIssueUpdateEmail({
      kind: status === "resolved" ? "resolved" : "reopened",
      user: issue.user,
      title: issue.media.title,
      issueId: id,
    });
  }
  return true;
}
