import { prisma } from "@/lib/prisma";
import { fetchAllKomgaSeries, getKomgaSeriesUrl } from "@/lib/komga";
import { extractYear, isNearTitle, normalizedTitles, parseJsonArray } from "@/lib/titles";
import type { Availability, MediaResult } from "@/lib/types";

export interface LibraryEntry {
  id: string;
  name: string;
  year: number | null;
  booksCount: number;
}

interface LibraryIndex {
  byTitle: Map<string, LibraryEntry[]>;
  byId: Map<string, LibraryEntry>;
  /** Titres regroupés par premier mot, pour la recherche approchée */
  byFirstWord: Map<string, string[]>;
}

const firstWord = (title: string) => title.split(" ", 1)[0];

// Sur globalThis : la synchro planifiée (instrumentation) et les routes ne partagent pas forcément le même module
const shared = globalThis as unknown as { libraryIndex?: Promise<LibraryIndex> | null };

/** Index en mémoire de la copie locale de Komga (quelques milliers de séries au plus). */
export function getLibraryIndex(): Promise<LibraryIndex> {
  shared.libraryIndex ??= prisma.librarySeries.findMany().then((rows) => {
    const byTitle = new Map<string, LibraryEntry[]>();
    const byId = new Map<string, LibraryEntry>();
    for (const row of rows) {
      const entry: LibraryEntry = { id: row.id, name: row.name, year: row.year, booksCount: row.booksCount };
      byId.set(row.id, entry);
      for (const title of parseJsonArray<string>(row.titles) ?? []) {
        byTitle.set(title, [...(byTitle.get(title) ?? []), entry]);
      }
    }
    const byFirstWord = new Map<string, string[]>();
    for (const title of byTitle.keys()) {
      byFirstWord.set(firstWord(title), [...(byFirstWord.get(firstWord(title)) ?? []), title]);
    }
    return { byTitle, byId, byFirstWord };
  });
  return shared.libraryIndex;
}

/**
 * Série Komga correspondant à l'un des titres (comparaison stricte des titres normalisés).
 * Quand les deux années sont connues ("Spider-Man (2018)"), elles doivent coïncider.
 */
export function findLibrarySeries(
  index: LibraryIndex,
  titles: (string | null | undefined)[],
  year?: number | null
): LibraryEntry | null {
  const wanted = normalizedTitles(titles);
  let candidates = wanted.flatMap((title) => index.byTitle.get(title) ?? []);

  // Aucune correspondance exacte : tolère une faute de frappe entre titres qui commencent pareil
  if (candidates.length === 0) {
    candidates = wanted.flatMap((title) =>
      (index.byFirstWord.get(firstWord(title)) ?? [])
        .filter((known) => isNearTitle(title, known))
        .flatMap((known) => index.byTitle.get(known) ?? [])
    );
  }

  const compatible = candidates.filter((entry) => !entry.year || !year || entry.year === year);
  // Préfère une série dont l'année confirme la correspondance, puis la plus fournie
  compatible.sort((a, b) => Number(Boolean(b.year)) - Number(Boolean(a.year)) || b.booksCount - a.booksCount);
  return compatible[0] ?? null;
}

/** Remplace la copie locale par l'état actuel de Komga. */
export async function refreshLibraryCache(): Promise<number> {
  const series = await fetchAllKomgaSeries();
  const now = new Date();

  await prisma.$transaction([
    prisma.librarySeries.deleteMany(),
    prisma.librarySeries.createMany({
      data: series.map((s) => ({
        id: s.id,
        name: s.name,
        titles: JSON.stringify(normalizedTitles(s.titles)),
        year: s.titles.map(extractYear).find((y) => y !== null) ?? null,
        booksCount: s.booksCount,
        syncedAt: now,
      })),
    }),
  ]);

  shared.libraryIndex = null;
  return series.length;
}

export function libraryStatus(entry: LibraryEntry, volumeCount: number | null | undefined): Availability {
  return {
    status: volumeCount && entry.booksCount < volumeCount ? "partially_available" : "available",
    booksInLibrary: entry.booksCount,
    librarySeriesUrl: getKomgaSeriesUrl(entry.id),
  };
}

/** Disponibilité de chaque résultat : bibliothèque Komga d'abord, puis état des demandes. */
export async function annotateAvailability<T extends MediaResult>(results: T[]): Promise<T[]> {
  if (results.length === 0) return results;

  const [index, medias] = await Promise.all([
    getLibraryIndex(),
    prisma.media.findMany({
      where: { externalId: { in: [...new Set(results.map((r) => r.id))] } },
      select: { mediaType: true, externalId: true, status: true, komgaSeriesId: true, volumeCount: true },
    }),
  ]);
  const mediaByKey = new Map(medias.map((m) => [`${m.mediaType}:${m.externalId}`, m]));

  return results.map((result) => {
    const media = mediaByKey.get(`${result.type}:${result.id}`);
    const entry =
      (media?.komgaSeriesId && index.byId.get(media.komgaSeriesId)) ||
      findLibrarySeries(index, [result.title, ...(result.altTitles ?? [])], result.year);

    let availability: Availability | null = null;
    if (entry) {
      availability = libraryStatus(entry, result.volumeCount ?? media?.volumeCount);
    } else if (media && media.status !== "unknown") {
      availability = { status: media.status as Availability["status"] };
    }
    return { ...result, availability };
  });
}
