/**
 * ComicVine REST API client for US comics search and details.
 * API docs: https://comicvine.gamespot.com/api/documentation
 * Requires API key (free, non-commercial).
 */

import type { MediaDetail, MediaResult, VolumeInfo, SearchPage } from "@/lib/types";
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

interface CVIssue {
  volume: { id: number; name: string };
  store_date: string | null;
}

/**
 * Séries ayant eu un numéro en magasin ces dernières semaines (éditeurs anglais / français),
 * de la plus récente sortie à la plus ancienne. Deux appels ComicVine au total.
 */
export async function getRecentComicVolumes(limit = 20, days = 21): Promise<MediaResult[]> {
  const apiKey = getApiKey();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86_400_000);

  const issuesUrl = `${COMICVINE_BASE}/issues/?api_key=${apiKey}&format=json&sort=store_date:desc&limit=100&filter=store_date:${iso(from)}|${iso(new Date())}&field_list=volume,store_date`;
  const issues: CVIssue[] = (await (await fetchWithRetry(issuesUrl)).json()).results ?? [];

  // Une entrée par série, dans l'ordre des sorties
  const volumeIds = [...new Set(issues.map((issue) => issue.volume.id))];
  if (volumeIds.length === 0) return [];

  const volumesUrl = `${COMICVINE_BASE}/volumes/?api_key=${apiKey}&format=json&limit=100&filter=id:${volumeIds.join("|")}&field_list=id,name,start_year,image,publisher,count_of_issues`;
  const volumes: CVSearchResult[] = (await (await fetchWithRetry(volumesUrl)).json()).results ?? [];
  const byId = new Map(volumes.map((vol) => [vol.id, vol]));

  return volumeIds
    .map((id) => byId.get(id))
    .filter((vol): vol is CVSearchResult => Boolean(vol) && isEnglishOrFrenchPublisher(vol?.publisher?.name))
    .slice(0, limit)
    .map((vol) => ({
      id: String(vol.id),
      title: vol.name || "Unknown",
      year: vol.start_year ? parseInt(vol.start_year, 10) : null,
      coverUrl: vol.image?.super_url || vol.image?.medium_url || null,
      type: "comic" as const,
      publisher: vol.publisher?.name || null,
      author: null,
      volumeCount: vol.count_of_issues || null,
    }));
}

/** Nombre de numéros actuel de plusieurs séries (1 appel ComicVine par tranche de 100). */
export async function getComicIssueCounts(ids: string[]): Promise<Map<string, number>> {
  const apiKey = getApiKey();
  const counts = new Map<string, number>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const url = `${COMICVINE_BASE}/volumes/?api_key=${apiKey}&format=json&limit=100&filter=id:${chunk.join("|")}&field_list=id,count_of_issues`;
    const volumes: { id: number; count_of_issues: number }[] = (await (await fetchWithRetry(url)).json()).results ?? [];
    for (const vol of volumes) counts.set(String(vol.id), vol.count_of_issues);
  }
  return counts;
}
