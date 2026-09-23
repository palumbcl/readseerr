/**
 * AniList GraphQL client for manga search and details.
 * API docs: https://anilist.gitbook.io/anilist-apiv2-docs/
 * No API key required for public queries.
 */

import type { MediaResult, MediaDetail, VolumeInfo, SearchPage } from "@/lib/types";
import { personNameMatches } from "@/lib/titles";

const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
query ($search: String!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage lastPage total }
    media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
      id
      popularity
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      startDate { year }
      format
      status
      description(asHtml: false)
      volumes
      chapters
      genres
      staff(sort: RELEVANCE, perPage: 3) {
        edges {
          role
          node { name { full } }
        }
      }
    }
  }
}
`;

const DETAILS_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: MANGA) {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      large
      extraLarge
    }
    bannerImage
    startDate { year month day }
    endDate { year month day }
    format
    status
    description(asHtml: false)
    volumes
    chapters
    genres
    averageScore
    staff(sort: RELEVANCE, perPage: 5) {
      edges {
        role
        node { name { full } }
      }
    }
  }
}
`;

interface AniListDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

interface AniListMedia {
  id: number;
  isAdult?: boolean;
  /** Nombre de membres AniList qui suivent la série */
  popularity?: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string | null; extraLarge: string | null };
  bannerImage: string | null;
  startDate: AniListDate;
  endDate?: AniListDate;
  format: string | null;
  status: string | null;
  description: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[];
  staff: {
    edges: Array<{
      role: string;
      node: { name: { full: string } };
    }>;
  };
}

async function queryAniList<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`AniList GraphQL error: ${json.errors[0]?.message}`);
  }

  return json.data;
}

function formatDate(date: AniListDate | undefined): string | null {
  if (!date?.year) return null;
  const parts = [String(date.year)];
  if (date.month) parts.push(String(date.month).padStart(2, "0"));
  if (date.day) parts.push(String(date.day).padStart(2, "0"));
  return parts.join("-");
}

function getAuthor(staff: AniListMedia["staff"]): string | null {
  const storyAuthor = staff.edges.find(
    (e) => e.role.toLowerCase().includes("story") || e.role.toLowerCase().includes("original")
  );
  return storyAuthor?.node.name.full ?? staff.edges[0]?.node.name.full ?? null;
}

function mapStatus(status: string | null): string | null {
  const statusMap: Record<string, string> = {
    FINISHED: "Terminé",
    RELEASING: "En cours",
    NOT_YET_RELEASED: "À paraître",
    CANCELLED: "Annulé",
    HIATUS: "En pause",
  };
  return status ? statusMap[status] ?? status : null;
}

/** Romaji / anglais : Komga range souvent les mangas sous l'un ou l'autre */
function getAltTitles(media: AniListMedia): string[] {
  return [media.title.english, media.title.romaji].filter((t): t is string => Boolean(t));
}

function mediaToResult(media: AniListMedia): MediaResult {
  return {
    id: String(media.id),
    title: media.title.english || media.title.romaji || media.title.native || "Unknown",
    year: media.startDate?.year ?? null,
    coverUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    type: "manga",
    publisher: null,
    author: getAuthor(media.staff),
    volumeCount: media.volumes,
    altTitles: getAltTitles(media),
    popularity: media.popularity ?? null,
  };
}

const PER_PAGE = 50; // AniList maximum

export async function searchManga(query: string, page = 1): Promise<SearchPage> {
  const data = await queryAniList<{
    Page: {
      pageInfo: { hasNextPage: boolean; lastPage: number; total: number };
      media: AniListMedia[];
    };
  }>(SEARCH_QUERY, {
    search: query,
    page,
    perPage: PER_PAGE,
  });

  const { pageInfo } = data.Page;
  return {
    results: data.Page.media.map(mediaToResult),
    hasMore: pageInfo.hasNextPage,
    totalPages: pageInfo.lastPage,
    total: pageInfo.total,
  };
}

export async function getMangaDetails(id: string): Promise<MediaDetail> {
  const data = await queryAniList<{ Media: AniListMedia }>(DETAILS_QUERY, {
    id: parseInt(id, 10),
  });

  const media = data.Media;

  // Generate volume list from volume count
  const volumes: VolumeInfo[] = [];
  if (media.volumes) {
    for (let i = 1; i <= media.volumes; i++) {
      volumes.push({ number: i, title: `Volume ${i}`, issueId: null });
    }
  }

  return {
    id: String(media.id),
    title: media.title.english || media.title.romaji || media.title.native || "Unknown",
    year: media.startDate?.year ?? null,
    coverUrl: media.coverImage?.extraLarge || media.coverImage?.large || null,
    type: "manga",
    publisher: null,
    author: getAuthor(media.staff),
    volumeCount: media.volumes,
    altTitles: getAltTitles(media),
    description: media.description,
    status: mapStatus(media.status),
    volumes,
    chapters: media.chapters,
    genres: media.genres || [],
    startDate: formatDate(media.startDate),
    endDate: formatDate(media.endDate),
    bannerUrl: media.bannerImage,
  };
}

const DISCOVER_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $startDateGreater: FuzzyDateInt, $popularityGreater: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(
      type: MANGA
      isAdult: false
      countryOfOrigin: "JP"
      format_in: [MANGA, ONE_SHOT]
      sort: $sort
      startDate_greater: $startDateGreater
      popularity_greater: $popularityGreater
    ) {
      id
      popularity
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      startDate { year }
      format
      status
      description(asHtml: false)
      volumes
      chapters
      genres
      staff(sort: RELEVANCE, perPage: 3) {
        edges {
          role
          node { name { full } }
        }
      }
    }
  }
}
`;

export type MangaDiscoverKind = "trending" | "popular" | "new";

/**
 * Mangas japonais (sans les webtoons coréens / chinois) pour la page Découvrir :
 * - trending : tendance du moment ;
 * - popular : les plus suivis, tous temps confondus ;
 * - new : lancés depuis moins d'un an et déjà suivis par une communauté conséquente.
 */
export async function discoverManga(kind: MangaDiscoverKind, page = 1): Promise<SearchPage> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const fuzzyDate = since.getFullYear() * 10000 + (since.getMonth() + 1) * 100 + since.getDate();

  const data = await queryAniList<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }>(
    DISCOVER_QUERY,
    {
      page,
      perPage: PER_PAGE,
      sort: [kind === "trending" ? "TRENDING_DESC" : "POPULARITY_DESC"],
      ...(kind === "new" && { startDateGreater: fuzzyDate, popularityGreater: 1000 }),
    }
  );

  let results = data.Page.media.map(mediaToResult);
  // AniList compare des dates approximatives : on écarte ce qui a une année de début plus ancienne
  if (kind === "new") results = results.filter((m) => !m.year || m.year >= since.getFullYear());
  return { results, hasMore: data.Page.pageInfo.hasNextPage };
}

const VOLUME_COUNTS_QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: MANGA) { id volumes }
  }
}
`;

/**
 * Nombre de tomes connu d'AniList pour plusieurs séries (1 appel par tranche de 50).
 * AniList ne le renseigne en général qu'une fois la série terminée : null pour les séries en cours.
 */
export async function getMangaVolumeCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).map((id) => parseInt(id, 10));
    const data = await queryAniList<{ Page: { media: { id: number; volumes: number | null }[] } }>(VOLUME_COUNTS_QUERY, {
      ids: chunk,
      perPage: 50,
    });
    for (const media of data.Page.media) {
      if (media.volumes) counts.set(String(media.id), media.volumes);
    }
  }
  return counts;
}

const AUTHOR_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 5) {
    staff(search: $search) {
      name { full alternative }
      favourites
      staffMedia(type: MANGA, perPage: 50, sort: [POPULARITY_DESC]) {
        nodes {
          id
          isAdult
          popularity
          title { romaji english native }
          coverImage { large extraLarge }
          bannerImage
          startDate { year }
          format
          status
          description(asHtml: false)
          volumes
          chapters
          genres
          staff(sort: RELEVANCE, perPage: 3) { edges { role node { name { full } } } }
        }
      }
    }
  }
}
`;

interface AniListStaff {
  name: { full: string; alternative: string[] };
  favourites: number;
  staffMedia: { nodes: AniListMedia[] };
}

/**
 * Œuvres des mangakas dont le nom correspond à la recherche ("Eiichiro Oda" -> One Piece…).
 * AniList orthographie parfois autrement ("Eiichirou") : sans résultat, on retente avec le mot le
 * plus long puis on garde les personnes dont le nom correspond vraiment.
 */
export async function searchMangaByAuthor(query: string): Promise<{ authors: string[]; results: MediaResult[] }> {
  // Un seul mot ("naruto") : on n'y voit un auteur que s'il est connu, sinon un titre suffit à déclencher
  // la recherche d'homonymes obscurs. Prénom + nom : la correspondance du nom suffit.
  const singleWord = query.trim().split(/\s+/).length === 1;
  const find = async (search: string) =>
    (await queryAniList<{ Page: { staff: AniListStaff[] } }>(AUTHOR_QUERY, { search })).Page.staff.filter(
      (s) =>
        (!singleWord || s.favourites >= 50) &&
        [s.name.full, ...s.name.alternative].some((name) => personNameMatches(query, name))
    );

  let staff = await find(query);
  const words = query.trim().split(/\s+/);
  if (staff.length === 0 && words.length > 1) {
    staff = await find([...words].sort((a, b) => b.length - a.length)[0]);
  }

  const seen = new Set<number>();
  const results: MediaResult[] = [];
  for (const person of staff.slice(0, 2)) {
    for (const media of person.staffMedia.nodes) {
      if (seen.has(media.id) || media.isAdult) continue;
      seen.add(media.id);
      // L'auteur affiché est celui recherché, même s'il n'est pas le premier crédité
      results.push({ ...mediaToResult(media), author: person.name.full });
    }
  }
  return { authors: staff.slice(0, 2).map((s) => s.name.full), results };
}
