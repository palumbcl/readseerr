import { prisma } from "@/lib/prisma";
import { MemoryCache, PersistentCache } from "@/lib/cache";
import { discoverManga } from "@/lib/anilist";
import { getComicVolumesByIds, getRecentComicVolumes } from "@/lib/comicvine";
import { POPULAR_COMIC_CANDIDATES } from "@/lib/popular-comics";
import { getPageviews } from "@/lib/wikipedia";
import { fetchLatestKomgaSeries, isKomgaConfigured } from "@/lib/komga";
import { annotateAvailability } from "@/lib/library";
import { parseJsonArray } from "@/lib/titles";
import type {
  DiscoverResponse,
  DiscoverRow,
  DiscoverRowId,
  DiscoverRowPage,
  LibraryRecentItem,
  MediaResult,
  MediaType,
  SearchPage,
} from "@/lib/types";

/** Nombre de cartes d'une rangée sur la page Découvrir ; « Voir tout » affiche la suite. */
const PREVIEW_SIZE = 20;
const DAY = 86_400;

// Persistant : un redémarrage ne relance pas les appels ComicVine / AniList.
// Une entrée par rangée et par page, partagée entre la rangée et sa page « Voir tout ».
const externalCache = ((globalThis as unknown as { discoverPagesCache?: PersistentCache<SearchPage> }).discoverPagesCache ??=
  new PersistentCache<SearchPage>("discover", 3900));
// Komga est local : rafraîchi souvent pour refléter les ajouts
const libraryCache = new MemoryCache<{ items: LibraryRecentItem[]; hasMore: boolean }>(120);

/**
 * Comics & BD les plus populaires : les séries candidates classées par consultations Wikipédia
 * des 60 derniers jours (anglais + français). 3 appels au total (Wikipédia en, fr, ComicVine).
 */
async function getPopularComics(): Promise<SearchPage> {
  const titles = (lang: "en" | "fr") =>
    POPULAR_COMIC_CANDIDATES.map((c) => c[lang]).filter((t): t is string => Boolean(t));
  const [en, fr] = await Promise.all([
    getPageviews("en", titles("en")).catch(() => new Map<string, number>()),
    getPageviews("fr", titles("fr")).catch(() => new Map<string, number>()),
  ]);

  const views = (c: (typeof POPULAR_COMIC_CANDIDATES)[number]) =>
    (c.en ? en.get(c.en) ?? 0 : 0) + (c.fr ? fr.get(c.fr) ?? 0 : 0);
  // Wikipédia injoignable : on garde l'ordre de la liste plutôt que de masquer la rangée
  const ranked = [...POPULAR_COMIC_CANDIDATES].sort((a, b) => views(b) - views(a));

  return { results: await getComicVolumesByIds(ranked.map((c) => c.id)), hasMore: false };
}

/** Dernières œuvres demandées, tous utilisateurs confondus (une entrée par œuvre). */
async function getRecentlyRequested(page: number, perPage = 50): Promise<SearchPage> {
  const requests = await prisma.request.findMany({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, media: true },
  });

  const seen = new Set<string>();
  const all: MediaResult[] = [];
  for (const { media } of requests) {
    // Anciennes demandes BD (source retirée) : plus de page détail à ouvrir
    if (seen.has(media.id) || (media.mediaType !== "manga" && media.mediaType !== "comic")) continue;
    seen.add(media.id);
    all.push({
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
  const start = (page - 1) * perPage;
  return { results: all.slice(start, start + perPage), hasMore: start + perPage < all.length };
}

interface RowSource {
  row: Omit<DiscoverRow, "items" | "hasMore">;
  /** Une page de résultats (à partir de 1) */
  loadPage: (page: number) => Promise<SearchPage>;
  /** Source externe mise en cache (sinon recalculée à chaque visite) */
  external: boolean;
  /** Durée de cache propre à la rangée (1 h par défaut) */
  ttlSeconds?: number;
}

const ROW_SOURCES: RowSource[] = [
  {
    row: { id: "trending-manga", title: "Tendances manga", subtitle: "Ce que les lecteurs suivent en ce moment" },
    loadPage: (page) => discoverManga("trending", page),
    external: true,
  },
  {
    row: { id: "popular-manga", title: "Mangas les plus populaires", subtitle: "Les séries les plus suivies au monde" },
    loadPage: (page) => discoverManga("popular", page),
    external: true,
    ttlSeconds: DAY,
  },
  {
    row: { id: "recent-comics", title: "Sorties comics récentes", subtitle: "Séries avec un nouveau numéro ces 3 dernières semaines" },
    loadPage: (page) => getRecentComicVolumes(page),
    external: true,
  },
  {
    row: {
      id: "popular-comics",
      title: "Comics & BD les plus populaires",
      subtitle: "Les séries qui intéressent le plus en ce moment dans le monde",
    },
    loadPage: () => getPopularComics(),
    external: true,
    ttlSeconds: DAY,
  },
  {
    row: { id: "new-manga", title: "Nouvelles séries manga", subtitle: "Lancées cette année et déjà populaires" },
    loadPage: (page) => discoverManga("new", page),
    external: true,
  },
  {
    row: { id: "recent-requests", title: "Demandes récentes", subtitle: "Les dernières œuvres demandées par les lecteurs" },
    loadPage: (page) => getRecentlyRequested(page),
    external: false,
  },
];

const LIBRARY_ROW = {
  id: "library" as const,
  title: "Ajouts récents dans la bibliothèque",
  subtitle: "Nouvelles séries et nouveaux tomes dans Komga",
};

const pageKey = (id: DiscoverRowId, page: number) => `${id}:p${page}`;

/** Une page d'une rangée, depuis le cache si possible. Une liste vide n'est jamais figée en cache. */
async function loadRowPage(source: RowSource, page: number): Promise<SearchPage> {
  if (!source.external) return source.loadPage(page);
  return externalCache.wrap(
    pageKey(source.row.id, page),
    () => source.loadPage(page),
    (value) => value.results.length > 0,
    source.ttlSeconds
  );
}

/** Une page est rechargée quand il lui reste moins de 15 min de validité. */
const REFRESH_MARGIN_MS = 15 * 60_000;

/**
 * Recharge en tâche de fond la première page des rangées externes sur le point d'expirer :
 * les visiteurs ne subissent jamais la lenteur de ComicVine, et un redémarrage ne coûte aucun appel.
 */
export async function warmDiscoverCache(): Promise<void> {
  await Promise.all(
    ROW_SOURCES.filter((source) => source.external).map(async (source) => {
      const key = pageKey(source.row.id, 1);
      try {
        if ((await externalCache.remainingMs(key)) > REFRESH_MARGIN_MS) return;
        const page = await source.loadPage(1);
        // Une liste vide vient d'une API en difficulté : on garde l'ancienne valeur et on réessaie plus tard
        if (page.results.length > 0) await externalCache.set(key, page, source.ttlSeconds);
      } catch (error) {
        console.error(`Discover: préchargement de "${source.row.id}" échoué`, error);
      }
    })
  );
}

async function getLibraryPage(page: number, size: number) {
  if (!isKomgaConfigured()) return null;
  try {
    const key = `${size}:${page}`;
    const hit = libraryCache.get(key);
    if (hit) return hit;
    const value = await fetchLatestKomgaSeries(size, page);
    libraryCache.set(key, value);
    return value;
  } catch (error) {
    console.error("Discover: Komga injoignable", error);
    return null;
  }
}

/** Contenu de la page Découvrir. Une source en panne masque seulement sa rangée. */
export async function getDiscover(): Promise<DiscoverResponse> {
  const [library, ...rowResults] = await Promise.all([
    getLibraryPage(1, PREVIEW_SIZE),
    ...ROW_SOURCES.map(async (source): Promise<DiscoverRow | null> => {
      try {
        const page = await loadRowPage(source, 1);
        const items = page.results.slice(0, PREVIEW_SIZE);
        // La disponibilité n'est jamais mise en cache : elle change à chaque demande / ajout Komga
        return {
          ...source.row,
          items: await annotateAvailability(items),
          hasMore: page.hasMore || page.results.length > PREVIEW_SIZE,
        };
      } catch (error) {
        console.error(`Discover: rangée "${source.row.id}" indisponible`, error);
        return null;
      }
    }),
  ]);

  return {
    library: library?.items ?? null,
    libraryHasMore: Boolean(library && (library.hasMore || library.items.length >= PREVIEW_SIZE)),
    rows: rowResults.filter((row): row is DiscoverRow => row !== null && row.items.length > 0),
  };
}

export function isDiscoverRowId(value: string): value is DiscoverRowId {
  return value === LIBRARY_ROW.id || ROW_SOURCES.some((source) => source.row.id === value);
}

/** Page « Voir tout » d'une rangée. */
export async function getDiscoverRowPage(id: DiscoverRowId, page: number): Promise<DiscoverRowPage | null> {
  if (id === "library") {
    const library = await getLibraryPage(page, 50);
    if (!library) return null;
    return { ...LIBRARY_ROW, kind: "library", library: library.items, items: [], hasMore: library.hasMore };
  }

  const source = ROW_SOURCES.find((s) => s.row.id === id);
  if (!source) return null;
  const result = await loadRowPage(source, page);
  return { ...source.row, kind: "media", items: await annotateAvailability(result.results), library: [], hasMore: result.hasMore };
}
