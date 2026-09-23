import { prisma } from "@/lib/prisma";
import { getComicIssueCounts } from "@/lib/comicvine";
import { getMangaVolumeCounts } from "@/lib/anilist";
import { sendDiscordNotification } from "@/lib/discord";
import { getKomgaSeriesUrl } from "@/lib/komga";
import { findMediaLibrarySeries, refreshMediaStatus, upsertMedia } from "@/lib/media";
import { sendFollowUpdateEmail } from "@/lib/notifications";
import { parseJsonArray } from "@/lib/titles";
import type { FollowedSeries, MediaType, RequestPayload } from "@/lib/types";

/** Suit une série (ou met à jour l'option de demande automatique). */
export async function followMedia(userId: string, payload: RequestPayload, autoRequest: boolean) {
  const media = await upsertMedia(payload);

  // Point de départ de la détection : pas de notification pour les tomes déjà présents
  if (media.libraryBooksCount === null) {
    const series = await findMediaLibrarySeries(media);
    await prisma.media.update({
      where: { id: media.id },
      data: { libraryBooksCount: series?.booksCount ?? 0, ...(series && { komgaSeriesId: series.id }) },
    });
  }

  return prisma.follow.upsert({
    where: { userId_mediaId: { userId, mediaId: media.id } },
    create: { userId, mediaId: media.id, autoRequest },
    update: { autoRequest },
  });
}

export async function unfollowMedia(userId: string, mediaType: string, externalId: string): Promise<void> {
  const media = await prisma.media.findUnique({
    where: { mediaType_externalId: { mediaType, externalId } },
    select: { id: true },
  });
  if (media) await prisma.follow.deleteMany({ where: { userId, mediaId: media.id } });
}

export async function listFollows(userId: string): Promise<FollowedSeries[]> {
  const follows = await prisma.follow.findMany({
    where: { userId },
    include: { media: true },
    orderBy: { createdAt: "desc" },
  });
  return follows.map(({ media, autoRequest, createdAt }) => ({
    mediaType: media.mediaType as MediaType,
    externalId: media.externalId,
    title: media.title,
    coverUrl: media.coverUrl,
    status: media.status,
    libraryBooksCount: media.libraryBooksCount,
    volumeCount: media.volumeCount,
    autoRequest,
    followedAt: createdAt.toISOString(),
  }));
}

/**
 * Après une synchronisation Komga : prévient les lecteurs quand de nouveaux tomes
 * d'une série suivie sont arrivés dans la bibliothèque.
 */
export async function notifyFollowedLibraryUpdates(): Promise<number> {
  const medias = await prisma.media.findMany({
    where: { follows: { some: {} } },
    include: { follows: { include: { user: true } } },
  });

  let notified = 0;
  for (const media of medias) {
    const series = await findMediaLibrarySeries(media);
    if (!series) continue;

    const previous = media.libraryBooksCount;
    if (previous !== null && series.booksCount > previous) {
      const results = await Promise.all(
        media.follows.map(({ user }) =>
          sendFollowUpdateEmail({
            kind: "library",
            user,
            title: media.title,
            coverUrl: media.coverUrl,
            count: series.booksCount - previous,
            libraryUrl: getKomgaSeriesUrl(series.id),
          })
        )
      );
      notified += results.filter(Boolean).length;
      console.log(`Suivi : ${series.booksCount - previous} nouveau(x) tome(s) de "${media.title}" dans Komga`);
    }

    if (previous !== series.booksCount || media.komgaSeriesId !== series.id) {
      await prisma.media.update({
        where: { id: media.id },
        data: { libraryBooksCount: series.booksCount, komgaSeriesId: series.id },
      });
    }
  }
  return notified;
}

/** Numéros N+1 … M d'une série passée de N à M tomes/numéros. */
function newNumbers(previous: number, current: number): number[] {
  return Array.from({ length: current - previous }, (_, i) => previous + i + 1);
}

/**
 * Nouvelles parutions des séries suivies (nombre de numéros ComicVine, de tomes AniList) :
 * prévient les lecteurs et crée les demandes de ceux qui ont activé la demande automatique.
 */
export async function checkFollowedReleases(): Promise<number> {
  const medias = await prisma.media.findMany({
    where: { follows: { some: {} } },
    include: { follows: { include: { user: true } } },
  });
  if (medias.length === 0) return 0;

  const idsOf = (type: MediaType) => medias.filter((m) => m.mediaType === type).map((m) => m.externalId);
  const [comicCounts, mangaCounts] = await Promise.all([
    idsOf("comic").length ? getComicIssueCounts(idsOf("comic")) : new Map<string, number>(),
    idsOf("manga").length ? getMangaVolumeCounts(idsOf("manga")) : new Map<string, number>(),
  ]);

  let releases = 0;
  for (const media of medias) {
    const current = (media.mediaType === "comic" ? comicCounts : mangaCounts).get(media.externalId);
    if (!current) continue;

    const previous = media.volumeCount;
    await prisma.media.update({ where: { id: media.id }, data: { volumeCount: current } });
    // Premier relevé, ou pas de nouveauté : rien à annoncer
    if (previous === null || current <= previous) continue;

    const volumes = newNumbers(previous, current);
    releases += volumes.length;
    console.log(`Suivi : ${volumes.length} nouvelle(s) parution(s) pour "${media.title}"`);

    for (const follow of media.follows) {
      const autoRequested = follow.autoRequest && (await autoRequestVolumes(media, follow.user, volumes));
      await sendFollowUpdateEmail({
        kind: "release",
        user: follow.user,
        title: media.title,
        coverUrl: media.coverUrl,
        count: volumes.length,
        autoRequested,
      });
    }
    await refreshMediaStatus(media.id);
  }
  return releases;
}

/**
 * Ajoute les nouveaux numéros à la demande en attente du lecteur, ou crée une demande.
 * Renvoie true si une demande a été créée ou complétée.
 */
async function autoRequestVolumes(
  media: { id: string; mediaType: string; externalId: string; title: string; coverUrl: string | null; year: number | null },
  user: { id: string; name: string; email: string },
  volumes: number[]
): Promise<boolean> {
  const pending = await prisma.request.findFirst({
    where: { mediaId: media.id, userId: user.id, status: "pending" },
  });

  let requested = volumes;
  if (pending) {
    const existing = parseJsonArray<number>(pending.volumes);
    // Demande "tous les tomes" : elle couvre déjà les nouveautés
    if (!existing) return true;
    requested = [...new Set([...existing, ...volumes])].sort((a, b) => a - b);
    await prisma.request.update({ where: { id: pending.id }, data: { volumes: JSON.stringify(requested) } });
  } else {
    await prisma.request.create({
      data: {
        userId: user.id,
        mediaId: media.id,
        mediaType: media.mediaType,
        externalId: media.externalId,
        title: media.title,
        coverUrl: media.coverUrl,
        volumes: JSON.stringify(volumes),
        status: "pending",
      },
    });
  }

  await sendDiscordNotification({
    title: media.title,
    mediaType: media.mediaType as MediaType,
    externalId: media.externalId,
    coverUrl: media.coverUrl,
    volumes,
    year: media.year,
    userName: user.name || user.email,
    automatic: true,
  });
  return true;
}
