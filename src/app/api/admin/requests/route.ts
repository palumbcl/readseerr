import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { getProwlarrSearchLink, getSourceLink } from "@/lib/discord";
import { getKomgaSeriesUrl } from "@/lib/komga";
import { findMediaLibrarySeries, OPEN_REQUEST_STATUSES } from "@/lib/media";
import type { AdminRequestRecord, MediaType, RequestStatus } from "@/lib/types";

const STATUSES: RequestStatus[] = ["pending", "approved", "declined", "available"];
const PAGE_SIZE = 50;

// GET : toutes les demandes, filtrées par statut, avec l'état de la bibliothèque
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const where = STATUSES.includes(status as RequestStatus) ? { status } : {};

  try {
    const [rows, total, grouped] = await Promise.all([
      prisma.request.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          handledBy: { select: { name: true } },
          media: { include: { requests: { select: { userId: true, status: true } } } },
        },
        // Les plus anciennes d'abord pour la file d'attente, les plus récentes pour l'historique
        orderBy: { createdAt: status === "pending" || status === "approved" ? "asc" : "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.request.count({ where }),
      prisma.request.groupBy({ by: ["status"], _count: true }),
    ]);

    const requests: AdminRequestRecord[] = await Promise.all(
      rows.map(async ({ media, ...req }) => {
        const series = await findMediaLibrarySeries(media);
        return {
          id: req.id,
          mediaType: req.mediaType as MediaType,
          externalId: req.externalId,
          title: req.title,
          coverUrl: req.coverUrl,
          volumes: req.volumes,
          status: req.status as RequestStatus,
          declineReason: req.declineReason,
          createdAt: req.createdAt.toISOString(),
          handledAt: req.handledAt?.toISOString() ?? null,
          user: req.user,
          handledBy: req.handledBy,
          library: series
            ? { name: series.name, url: getKomgaSeriesUrl(series.id), booksCount: series.booksCount }
            : null,
          otherRequests: media.requests.filter(
            (r) => r.userId !== req.userId && OPEN_REQUEST_STATUSES.includes(r.status)
          ).length,
          sourceUrl: getSourceLink(req.mediaType as MediaType, req.externalId)?.url ?? null,
          prowlarrUrl: getProwlarrSearchLink(req.title) ?? null,
        };
      })
    );

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>;
    for (const group of grouped) {
      if (STATUSES.includes(group.status as RequestStatus)) counts[group.status as RequestStatus] = group._count;
    }

    return NextResponse.json({ requests, counts, total, pageSize: PAGE_SIZE });
  } catch (err) {
    console.error("Admin requests error:", err);
    return NextResponse.json({ error: "Impossible de charger les demandes." }, { status: 500 });
  }
}
