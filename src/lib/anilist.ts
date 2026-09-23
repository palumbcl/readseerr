/**
 * AniList GraphQL client for manga search and details.
 * API docs: https://anilist.gitbook.io/anilist-apiv2-docs/
 * No API key required for public queries.
 */

import type { MediaResult, MediaDetail, VolumeInfo, SearchPage } from "@/lib/types";

const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
query ($search: String!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage lastPage total }
    media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
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
