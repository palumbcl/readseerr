import { PersistentCache } from "@/lib/cache";
import { normalizeTitle, seriesKey } from "@/lib/titles";

/**
 * Popularité des comics / BD, que ComicVine ne fournit pas : nombre de lecteurs Open Library
 * (listes de lecture + notes) des albums correspondant à la recherche, regroupés par série.
 * Un seul appel par recherche (deux pages de 100 œuvres), mis en cache 7 jours.
 */
const cache = ((globalThis as unknown as { comicPopularityCache?: PersistentCache<Record<string, number>> })
  .comicPopularityCache ??= new PersistentCache<Record<string, number>>("comicpop", 7 * 86_400));

const COMIC_SUBJECTS =
  'subject:comics OR subject:"comic books, strips, etc" OR subject:"graphic novels" OR subject:"bandes dessinées"';

interface OpenLibraryWork {
  title?: string;
  readinglog_count?: number;
  ratings_count?: number;
}

async function fetchPage(query: string, page: number): Promise<OpenLibraryWork[]> {
  const params = new URLSearchParams({
    q: `(${query}) AND (${COMIC_SUBJECTS})`,
    fields: "title,readinglog_count,ratings_count",
    sort: "readinglog",
    limit: "100",
    page: String(page),
  });
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Open Library a répondu ${response.status}.`);
  return (await response.json()).docs ?? [];
}

/** Score de popularité par clé de série (voir `seriesKey`). */
export async function getComicPopularity(query: string): Promise<Record<string, number>> {
  const cleaned = query.replace(/[()":]/g, " ").trim();
  if (cleaned.length < 2) return {};

  return cache.wrap(normalizeTitle(cleaned) || cleaned.toLowerCase(), async () => {
    const works = (await Promise.all([fetchPage(cleaned, 1), fetchPage(cleaned, 2)])).flat();
    const scores: Record<string, number> = {};
    for (const work of works) {
      if (!work.title) continue;
      const key = seriesKey(work.title);
      if (!key) continue;
      scores[key] = (scores[key] ?? 0) + (work.readinglog_count ?? 0) + 5 * (work.ratings_count ?? 0);
    }
    return scores;
  });
}

const authorCache = ((globalThis as unknown as { authorPopularityCache?: PersistentCache<Record<string, number>> })
  .authorPopularityCache ??= new PersistentCache<Record<string, number>>("authorpop", 7 * 86_400));

/** Lecteurs Open Library des œuvres d'un auteur, par clé de série (voir `seriesKey`). */
export async function getAuthorWorkScores(author: string): Promise<Record<string, number>> {
  return authorCache.wrap(normalizeTitle(author), async () => {
    const params = new URLSearchParams({
      author,
      fields: "title,readinglog_count,ratings_count",
      sort: "readinglog",
      limit: "100",
    });
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Open Library a répondu ${response.status}.`);
    const scores: Record<string, number> = {};
    for (const work of ((await response.json()).docs ?? []) as OpenLibraryWork[]) {
      const key = work.title ? seriesKey(work.title) : "";
      if (key) scores[key] = (scores[key] ?? 0) + (work.readinglog_count ?? 0) + 5 * (work.ratings_count ?? 0);
    }
    return scores;
  });
}

/**
 * Score d'une série : ses propres lecteurs plus ceux de ses albums, dont le titre commence par celui
 * de la série ("Astérix le Gaulois" compte pour "Astérix").
 */
export function seriesScore(key: string, scores: Record<string, number>): number {
  if (!key) return 0;
  let total = 0;
  for (const [workKey, value] of Object.entries(scores)) {
    if (workKey === key || workKey.startsWith(`${key} `)) total += value;
  }
  return total;
}
