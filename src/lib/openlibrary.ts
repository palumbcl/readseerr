/**
 * Open Library API client — secondary/fallback source for BD franco-belge.
 * Used when Google Books is rate-limited (429) or has no results.
 * Docs: https://openlibrary.org/developers/api
 * No API key required. No aggressive rate limiting.
 */

import type { MediaResult, MediaDetail, VolumeInfo } from "@/lib/types";

const OL_SEARCH = "https://openlibrary.org/search.json";
const OL_COVERS = "https://covers.openlibrary.org/b/id";
const OL_API = "https://openlibrary.org";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  publisher?: string[];
  isbn?: string[];
  language?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

interface OLSearchResponse {
  numFound: number;
  docs: OLDoc[];
}

interface OLWorkResponse {
  key: string;
  title: string;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  created?: { value: string };
}

interface OLAuthorResponse {
  name: string;
  bio?: string | { value: string };
}

interface OLEdition {
  key: string;
  title: string;
  publishers?: string[];
  publish_date?: string;
  covers?: number[];
  number_of_pages?: number;
  isbn_13?: string[];
  isbn_10?: string[];
}

interface OLEditionsResponse {
  entries: OLEdition[];
}

export async function searchBDOpenLibrary(query: string): Promise<MediaResult[]> {
  const url = `${OL_SEARCH}?q=${encodeURIComponent(query)}&language=fre&limit=20`;

  const response = await fetch(url, {
    headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
  });

  if (!response.ok) {
    throw new Error(`Open Library API error: ${response.status}`);
  }

  const data: OLSearchResponse = await response.json();

  return data.docs.map((doc) => ({
    id: doc.key.replace("/works/", "ol-"),
    title: doc.title,
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i ? `${OL_COVERS}/${doc.cover_i}-L.jpg` : null,
    type: "bd" as const,
    publisher: doc.publisher?.[0] || null,
    author: doc.author_name?.[0] || null,
  }));
}

/**
 * Get detailed information about a work from Open Library.
 * IDs are stored as "ol-OL12345W" and map to "/works/OL12345W".
 */
export async function getBDDetailsOpenLibrary(olId: string): Promise<MediaDetail> {
  // Convert our internal ID format back to Open Library format
  const workKey = olId.replace("ol-", "");
  const workUrl = `${OL_API}/works/${workKey}.json`;

  const response = await fetch(workUrl, {
    headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
  });

  if (!response.ok) {
    throw new Error(`Open Library work API error: ${response.status}`);
  }

  const work: OLWorkResponse = await response.json();

  // Get description (can be string or { value: string })
  let description: string | null = null;
  if (work.description) {
    description = typeof work.description === "string"
      ? work.description
      : work.description.value;
  }

  // Get cover
  const coverUrl = work.covers && work.covers.length > 0
    ? `${OL_COVERS}/${work.covers[0]}-L.jpg`
    : null;

  // Fetch editions to get publisher, volumes, etc.
  let publisher: string | null = null;
  let publishDate: string | null = null;
  const volumes: VolumeInfo[] = [];

  try {
    const editionsUrl = `${OL_API}/works/${workKey}/editions.json?limit=50`;
    const editionsResp = await fetch(editionsUrl, {
      headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
    });

    if (editionsResp.ok) {
      const editions: OLEditionsResponse = await editionsResp.json();

      if (editions.entries && editions.entries.length > 0) {
        // Get publisher from first edition
        publisher = editions.entries[0].publishers?.[0] || null;
        publishDate = editions.entries[0].publish_date || null;

        // Build volumes list from French editions
        let volNum = 1;
        for (const edition of editions.entries) {
          volumes.push({
            number: volNum++,
            title: edition.title,
            issueId: edition.key.replace("/books/", ""),
          });
        }
      }
    }
  } catch {
    // Editions are optional
  }

  // Fetch author name
  let authorName: string | null = null;
  try {
    // Get authors from search results (faster than fetching author API)
    const searchUrl = `${OL_SEARCH}?q=${encodeURIComponent(work.title)}&limit=1`;
    const searchResp = await fetch(searchUrl, {
      headers: { "User-Agent": "ReadSeerr/1.0 (self-hosted reading request app)" },
    });
    if (searchResp.ok) {
      const searchData: OLSearchResponse = await searchResp.json();
      if (searchData.docs.length > 0) {
        authorName = searchData.docs[0].author_name?.[0] || null;
      }
    }
  } catch {
    // Author is optional
  }

  // Extract year from publish date
  let year: number | null = null;
  if (publishDate) {
    const match = publishDate.match(/(\d{4})/);
    if (match) year = parseInt(match[1], 10);
  }

  return {
    id: olId,
    title: work.title,
    year,
    coverUrl,
    type: "bd",
    publisher,
    author: authorName,
    description,
    status: publishDate ? `Publié : ${publishDate}` : null,
    volumes,
    chapters: null,
    genres: (work.subjects || []).slice(0, 10),
    startDate: publishDate || null,
    endDate: null,
    bannerUrl: null,
  };
}
