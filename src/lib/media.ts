import type { Media, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendDiscordAvailableNotification } from "@/lib/discord";
import { sendRequestStatusEmail } from "@/lib/notifications";
import { fetchKomgaBookNumbers, getKomgaSeriesUrl, isKomgaConfigured } from "@/lib/komga";
import { findLibrarySeries, getLibraryIndex, libraryStatus, refreshLibraryCache, type LibraryEntry } from "@/lib/library";
import { normalizeTitle, parseJsonArray } from "@/lib/titles";
import type {
  Availability,
  AvailabilityStatus,
  DetailAvailability,
  MediaResult,
  MediaType,
  RequestPayload,
  RequestStatus,
} from "@/lib/types";

/** Demandes que l'admin doit encore traiter */
export const OPEN_REQUEST_STATUSES = ["pending", "approved"];

/** Crée ou met à jour la fiche de l'œuvre avec les dernières métadonnées connues. */
export function upsertMedia(payload: RequestPayload): Promise<Media> {
  const data = {
    title: payload.title,
    coverUrl: payload.coverUrl || null,
    altTitles: payload.altTitles?.length ? JSON.stringify(payload.altTitles) : null,
    year: payload.year ?? null,
    volumeCount: payload.volumeCount ?? null,
  };
  return prisma.media.upsert({
    where: { mediaType_externalId: { mediaType: payload.mediaType, externalId: payload.externalId } },
    create: { mediaType: payload.mediaType, externalId: payload.externalId, ...data },
    update: data,
  });
}

export function mediaTitles(media: Pick<Media, "title" | "altTitles">): string[] {
  return [media.title, ...(parseJsonArray<string>(media.altTitles) ?? [])];
}

/** Série Komga de l'œuvre : celle liée explicitement, sinon rapprochement par titre. */
export async function findMediaLibrarySeries(
  media: Pick<Media, "title" | "altTitles" | "year" | "komgaSeriesId">
): Promise<LibraryEntry | null> {
  const index = await getLibraryIndex();
  return (
    (media.komgaSeriesId && index.byId.get(media.komgaSeriesId)) ||
    findLibrarySeries(index, mediaTitles(media), media.year)
  );
}

/** Recalcule le statut agrégé de l'œuvre à partir de la bibliothèque et de ses demandes. */
export async function refreshMediaStatus(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { requests: { select: { status: true } } },
  });
  if (!media) return;

  const statuses = new Set(media.requests.map((r) => r.status));
  const series = await findMediaLibrarySeries(media);

  const status = series
    ? libraryStatus(series, media.volumeCount).status
    : statuses.has("available")
      ? "available"
      : statuses.has("approved")
        ? "processing"
        : statuses.has("pending")
          ? "pending"
          : "unknown";

  const becameAvailable = status === "available" && media.status !== "available";
  await prisma.media.update({
    where: { id: mediaId },
    data: {
      status,
      ...(series && { komgaSeriesId: series.id }),
      ...(becameAvailable && { availableAt: new Date() }),
    },
  });
}

type RequestWithUser = Prisma.RequestGetPayload<{ include: { user: true } }>;

/**
 * Passe des demandes d'une même œuvre à "disponible" et prévient les demandeurs
 * (un email par utilisateur, une notification Discord par œuvre).
 */
export async function markRequestsAvailable({
  media,
  requests,
  seriesName,
  handledById,
}: {
  media: Media;
  requests: RequestWithUser[];
  seriesName: string;
  handledById?: string;
}): Promise<void> {
  if (requests.length === 0) return;

  await prisma.request.updateMany({
    where: { id: { in: requests.map((r) => r.id) } },
    data: { status: "available", handledAt: new Date(), ...(handledById && { handledById }) },
  });
  await refreshMediaStatus(media.id);

  const users = [...new Map(requests.map((r) => [r.userId, r.user])).values()];
  const emailResults = await Promise.all(
    users.map((user) => sendRequestStatusEmail({ kind: "available", user, title: media.title, coverUrl: media.coverUrl }))
  );

  await sendDiscordAvailableNotification({
    title: media.title,
    mediaType: media.mediaType as MediaType,
    coverUrl: media.coverUrl,
    komgaSeriesName: seriesName,
    userNames: users.map((user) => user.name || user.email),
    emailedCount: emailResults.filter(Boolean).length,
  });

  console.log(`Demande(s) disponible(s) : "${media.title}" (${requests.length})`);
}

/**
 * Une demande est satisfaite quand tous les tomes demandés sont dans Komga
 * (ou dès que la série y est, si aucun tome n'a été précisé).
 */
function isFulfilled(request: { volumes: string | null }, bookNumbers: number[] | null): boolean {
  const requested = parseJsonArray<number>(request.volumes);
  if (!requested || requested.length === 0) return true;
  if (!bookNumbers) return false;
  return requested.every((volume) => bookNumbers.includes(volume));
}

function groupByMedia<T extends { mediaId: string }>(requests: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const request of requests) {
    groups.set(request.mediaId, [...(groups.get(request.mediaId) ?? []), request]);
  }
  return [...groups.values()];
}

/** Rapproche les demandes en cours de la bibliothèque et clôt celles qui sont satisfaites. */
export async function reconcileOpenRequests(): Promise<number> {
  const openRequests = await prisma.request.findMany({
    where: { status: { in: OPEN_REQUEST_STATUSES } },
    include: { user: true, media: true },
  });

  let fulfilledCount = 0;
  for (const requests of groupByMedia(openRequests)) {
    const { media } = requests[0];
    const series = await findMediaLibrarySeries(media);
    if (!series) continue;

    const needsNumbers = requests.some((r) => parseJsonArray<number>(r.volumes)?.length);
    const bookNumbers = needsNumbers ? await fetchKomgaBookNumbers(series.id) : null;
    const fulfilled = requests.filter((r) => isFulfilled(r, bookNumbers));

    if (fulfilled.length > 0) {
      await markRequestsAvailable({ media, requests: fulfilled, seriesName: series.name });
      fulfilledCount += fulfilled.length;
    } else {
      await refreshMediaStatus(media.id);
    }
  }
  return fulfilledCount;
}

/**
 * Sans accès à l'API Komga : clôt les demandes dont le titre correspond exactement
 * à l'un des titres reçus par le webhook (ancien comportement).
 */
export async function fulfillByTitles(candidateTitles: string[], seriesName: string): Promise<number> {
  const wanted = new Set(candidateTitles.map(normalizeTitle).filter(Boolean));
  const openRequests = await prisma.request.findMany({
    where: { status: { in: OPEN_REQUEST_STATUSES } },
    include: { user: true, media: true },
  });
  const matched = openRequests.filter((r) => mediaTitles(r.media).some((t) => wanted.has(normalizeTitle(t))));

  for (const requests of groupByMedia(matched)) {
    await markRequestsAvailable({ media: requests[0].media, requests, seriesName });
  }
  return matched.length;
}

export interface LibrarySyncState {
  configured: boolean;
  running: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  seriesCount: number | null;
  lastFulfilled: number | null;
}

interface SyncRuntime {
  state: Omit<LibrarySyncState, "configured">;
  inFlight: Promise<LibrarySyncState> | null;
  rerunRequested: boolean;
}

// Sur globalThis : partagé entre la synchro planifiée (instrumentation) et les routes API
const sync = ((globalThis as unknown as { librarySync?: SyncRuntime }).librarySync ??= {
  state: { running: false, lastSyncAt: null, lastError: null, seriesCount: null, lastFulfilled: null },
  inFlight: null,
  rerunRequested: false,
});
const syncState = sync.state;

export function getLibrarySyncState(): LibrarySyncState {
  return { ...syncState, configured: isKomgaConfigured() };
}

async function runSync(): Promise<LibrarySyncState> {
  syncState.running = true;
  try {
    do {
      sync.rerunRequested = false;
      syncState.seriesCount = await refreshLibraryCache();
      syncState.lastFulfilled = await reconcileOpenRequests();
      // Import dynamique : follows.ts dépend lui-même de ce module
      const { notifyFollowedLibraryUpdates } = await import("@/lib/follows");
      await notifyFollowedLibraryUpdates();
      syncState.lastSyncAt = new Date().toISOString();
      syncState.lastError = null;
    } while (sync.rerunRequested);
  } catch (error) {
    syncState.lastError = error instanceof Error ? error.message : String(error);
    console.error("Synchronisation Komga échouée:", error);
  } finally {
    syncState.running = false;
    sync.inFlight = null;
  }
  return getLibrarySyncState();
}

/**
 * Synchronise la bibliothèque puis clôt les demandes satisfaites.
 * Les appels rapprochés (import de nombreux tomes = rafale de webhooks) sont fusionnés.
 */
export function syncLibrary(): Promise<LibrarySyncState> {
  if (!isKomgaConfigured()) {
    return Promise.resolve({ ...getLibrarySyncState(), lastError: "Komga n'est pas configuré (KOMGA_URL + clé API)." });
  }
  if (sync.inFlight) {
    sync.rerunRequested = true;
    return sync.inFlight;
  }
  sync.inFlight = runSync();
  return sync.inFlight;
}

/** Bibliothèque, demande de l'utilisateur et demandes des autres, pour la page détail. */
export async function getDetailAvailability(
  userId: string,
  result: Pick<MediaResult, "type" | "id" | "title" | "altTitles" | "year" | "volumeCount">
): Promise<DetailAvailability> {
  const media = await prisma.media.findUnique({
    where: { mediaType_externalId: { mediaType: result.type, externalId: result.id } },
    include: { requests: { orderBy: { createdAt: "desc" } } },
  });

  const index = await getLibraryIndex();
  const series =
    (media?.komgaSeriesId && index.byId.get(media.komgaSeriesId)) ||
    findLibrarySeries(index, [result.title, ...(result.altTitles ?? [])], result.year);

  const mine = media?.requests.find((r) => r.userId === userId) ?? null;
  const follow = media
    ? await prisma.follow.findUnique({ where: { userId_mediaId: { userId, mediaId: media.id } } })
    : null;
  const otherRequests =
    media?.requests.filter((r) => r.userId !== userId && OPEN_REQUEST_STATUSES.includes(r.status)).length ?? 0;

  let availability: Availability | null = null;
  if (series) availability = libraryStatus(series, result.volumeCount ?? media?.volumeCount);
  else if (media && media.status !== "unknown") availability = { status: media.status as AvailabilityStatus };

  return {
    availability,
    library: series
      ? {
          name: series.name,
          url: getKomgaSeriesUrl(series.id),
          booksCount: series.booksCount,
          volumes: await fetchKomgaBookNumbers(series.id),
        }
      : null,
    myRequest: mine
      ? {
          id: mine.id,
          status: mine.status as RequestStatus,
          volumes: parseJsonArray<number>(mine.volumes),
          declineReason: mine.declineReason,
        }
      : null,
    otherRequests,
    follow: follow ? { autoRequest: follow.autoRequest } : null,
  };
}
