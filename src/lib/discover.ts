import { prisma } from "@/lib/prisma";
import { MemoryCache } from "@/lib/cache";
import { getNewManga, getTrendingManga } from "@/lib/anilist";
import { getRecentComicVolumes } from "@/lib/comicvine";
import { fetchLatestKomgaSeries, isKomgaConfigured } from "@/lib/komga";
import { annotateAvailability } from "@/lib/library";
import { parseJsonArray } from "@/lib/titles";
import type { DiscoverResponse, DiscoverRow, LibraryRecentItem, MediaResult, MediaType } from "@/lib/types";

// 1 h : ménage le quota ComicVine (~200 requêtes/heure) et AniList (90/minute)
// Sur globalThis : le préchargement (instrumentation) et la route API partagent le même cache
const externalCache = ((globalThis as unknown as { discoverCache?: MemoryCache<MediaResult[]> }).discoverCache ??=
  new MemoryCache<MediaResult[]>(3900));
// Komga est local : rafraîchi souvent pour refléter les ajouts
const libraryCache = new MemoryCache<LibraryRecentItem[]>(120);

async function cached<T>(cache: MemoryCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = await load();
  cache.set(key, value);
  return value;
}

/**
 * Recharge les rangées externes en tâche de fond (démarrage, puis chaque heure) :
 * les visiteurs ne subissent jamais la lenteur de ComicVine.
 */
export async function warmDiscoverCache(): Promise<void> {
  await Promise.all(
    ROW_SOURCES.filter((source) => source.external).map(async ({ row, load }) => {
      try {
        externalCache.set(row.id, await load());
      } catch (error) {
        console.error(`Discover: préchargement de "${row.id}" échoué`, error);
      }
    })
  );
}

/** Dernières œuvres demandées, tous utilisateurs confondus (une entrée par œuvre). */
async function getRecentlyRequested(limit = 20): Promise<MediaResult[]> {
  const requests = await prisma.request.findMany({
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    include: { media: true },
  });

  const seen = new Set<string>();
  const results: MediaResult[] = [];
  for (const { media } of requests) {
    if (seen.has(media.id) || results.length >= limit) continue;
    seen.add(media.id);
    results.push({
      id: media.externalId,
      title: media.title,
      year: media.year,
      coverUrl: media.coverUrl,
      type: media.mediaType as MediaType,
      publisher: null,
      author: null,
      volumeCount: media.volumeCount,
      altTitles: parseJsonArray<string>(media.altTitles) ?? undefined,
    });
  }
  // Anciennes demandes BD (source retirée) : plus de page détail à ouvrir
  return results.filter((r) => r.type === "manga" || r.type === "comic");
}

async function getLibraryRow(): Promise<LibraryRecentItem[] | null> {
  if (!isKomgaConfigured()) return null;
  try {
    return await cached(libraryCache, "latest", () => fetchLatestKomgaSeries(20));
  } catch (error) {
    console.error("Discover: Komga injoignable", error);
    return null;
  }
}

const ROW_SOURCES: { row: Omit<DiscoverRow, "items">; load: () => Promise<MediaResult[]>; external: boolean }[] = [
  {
    row: { id: "trending-manga", title: "Tendances manga", subtitle: "Ce que les lecteurs suivent en ce moment" },
    load: () => getTrendingManga(20),
    external: true,
  },
  {
    row: { id: "recent-comics", title: "Sorties comics récentes", subtitle: "Séries avec un nouveau numéro ces 3 dernières semaines" },
    load: () => getRecentComicVolumes(20),
    external: true,
  },
  {
    row: { id: "new-manga", title: "Nouvelles séries manga", subtitle: "Lancées cette année et déjà populaires" },
    load: () => getNewManga(20),
    external: true,
  },
  {
    row: { id: "recent-requests", title: "Demandes récentes", subtitle: "Les dernières œuvres demandées par les lecteurs" },
    load: () => getRecentlyRequested(20),
    external: false,
  },
];

/** Contenu de la page Découvrir. Une source en panne masque seulement sa rangée. */
export async function getDiscover(): Promise<DiscoverResponse> {
  const [library, ...rowResults] = await Promise.all([
    getLibraryRow(),
    ...ROW_SOURCES.map(async ({ row, load, external }) => {
      try {
        const items = external ? await cached(externalCache, row.id, load) : await load();
        // La disponibilité n'est jamais mise en cache : elle change à chaque demande / ajout Komga
        return { ...row, items: await annotateAvailability(items) };
      } catch (error) {
        console.error(`Discover: rangée "${row.id}" indisponible`, error);
        return null;
      }
    }),
  ]);

  return {
    library,
    rows: rowResults.filter((row): row is DiscoverRow => row !== null && row.items.length > 0),
  };
}
