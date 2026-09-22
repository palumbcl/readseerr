/**
 * ComicVine REST API client for US comics search and details.
 * API docs: https://comicvine.gamespot.com/api/documentation
 * Requires API key (free, non-commercial).
 */

import type { MediaDetail, VolumeInfo, SearchPage } from "@/lib/types";
import { isEnglishOrFrenchPublisher } from "@/lib/publishers";

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";
const USER_AGENT = "ReadSeerr/1.0";

function getApiKey(): string {
  const key = process.env.COMICVINE_API_KEY;
  if (!key) throw new Error("COMICVINE_API_KEY is not set in environment variables.");
  return key;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (response.ok) return response;

      // Retry on server errors
      if (response.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      throw new Error(`ComicVine API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("ComicVine API: max retries exceeded");
}

interface CVSearchResult {
  id: number;
  name: string;
  start_year: string | null;
  image: { medium_url: string; super_url: string } | null;
  publisher: { name: string } | null;
  count_of_issues: number;
  description: string | null;
  deck: string | null;
}

interface CVVolumeDetail {
  id: number;
  name: string;
  start_year: string | null;
  image: { medium_url: string; super_url: string } | null;
  publisher: { name: string } | null;
  count_of_issues: number;
  description: string | null;
  deck: string | null;
  issues: Array<{
    id: number;
    issue_number: string;
    name: string | null;
  }>;
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const PER_PAGE = 100; // ComicVine maximum

export async function searchComics(query: string, page = 1): Promise<SearchPage> {
  const apiKey = getApiKey();
  const url = `${COMICVINE_BASE}/search/?api_key=${apiKey}&format=json&resources=volume&query=${encodeURIComponent(query)}&limit=${PER_PAGE}&page=${page}&field_list=id,name,start_year,image,publisher,count_of_issues,deck`;

  const response = await fetchWithRetry(url);
  const data = await response.json();

  if (data.error !== "OK" && data.status_code !== 1) {
    throw new Error(`ComicVine search error: ${data.error}`);
  }

  // Foreign-language editions are dropped, so a page may hold fewer than PER_PAGE results
  const results: CVSearchResult[] = (data.results || []).filter((vol: CVSearchResult) =>
    isEnglishOrFrenchPublisher(vol.publisher?.name)
  );

  const fetched = (data.offset ?? 0) + (data.number_of_page_results ?? 0);
  const total: number = data.number_of_total_results ?? 0;

  return {
    results: results.map((vol) => ({
      id: String(vol.id),
      title: vol.name || "Unknown",
      year: vol.start_year ? parseInt(vol.start_year, 10) : null,
      coverUrl: vol.image?.super_url || vol.image?.medium_url || null,
      type: "comic" as const,
      publisher: vol.publisher?.name || null,
      author: null,
      volumeCount: vol.count_of_issues || null,
    })),
    hasMore: (data.number_of_page_results ?? 0) > 0 && fetched < total,
    totalPages: Math.ceil(total / PER_PAGE),
    total,
  };
}

export async function getComicDetails(id: string): Promise<MediaDetail> {
  const apiKey = getApiKey();
  const url = `${COMICVINE_BASE}/volume/4050-${id}/?api_key=${apiKey}&format=json&field_list=id,name,start_year,image,publisher,count_of_issues,description,deck,issues`;

  const response = await fetchWithRetry(url);
  const data = await response.json();

  if (data.error !== "OK" && data.status_code !== 1) {
    throw new Error(`ComicVine details error: ${data.error}`);
  }

  const vol: CVVolumeDetail = data.results;

  const volumes: VolumeInfo[] = (vol.issues || [])
    .sort((a, b) => parseFloat(a.issue_number) - parseFloat(b.issue_number))
    .map((issue) => ({
      number: parseFloat(issue.issue_number) || 0,
      title: issue.name,
      issueId: String(issue.id),
    }));

  return {
    id: String(vol.id),
    title: vol.name || "Unknown",
    year: vol.start_year ? parseInt(vol.start_year, 10) : null,
    coverUrl: vol.image?.super_url || vol.image?.medium_url || null,
    type: "comic",
    publisher: vol.publisher?.name || null,
    author: null,
    description: stripHtml(vol.description) || stripHtml(vol.deck),
    status: vol.count_of_issues > 0 ? `${vol.count_of_issues} issues` : null,
    volumes,
    chapters: null,
    genres: [],
    startDate: vol.start_year || null,
    endDate: null,
    bannerUrl: null,
  };
}
