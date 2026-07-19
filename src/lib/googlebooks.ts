/**
 * Google Books API client for BD franco-belge (primary source).
 * No API key required for basic search queries.
 * Docs: https://developers.google.com/books/docs/v1/using
 *
 * NOTE: Google Books has aggressive rate limiting without an API key.
 * We implement throttling and retry with exponential backoff.
 */

import type { MediaResult, MediaDetail, VolumeInfo } from "@/lib/types";

const GBOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

// Throttle: minimum delay between requests to avoid 429
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1500; // 1.5s between calls

interface GBVolumeInfo {
  title: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  pageCount?: number;
  categories?: string[];
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
  language?: string;
}

interface GBVolume {
  id: string;
  volumeInfo: GBVolumeInfo;
}

interface GBSearchResponse {
  totalItems: number;
  items?: GBVolume[];
}

async function throttledFetch(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Enforce minimum interval between requests
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
    }
    lastRequestTime = Date.now();

    const response = await fetch(url);

    if (response.ok) return response;

    // Handle 429 Too Many Requests with exponential backoff
    if (response.status === 429 && attempt < retries) {
      const backoff = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      console.warn(`Google Books 429 rate limited, retrying in ${backoff}ms (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    // On final 429, return empty results instead of throwing
    if (response.status === 429) {
      console.warn("Google Books API rate limit exceeded. Returning empty results.");
      return response; // Caller will handle non-ok response gracefully
    }

    if (!response.ok && response.status !== 429) {
      throw new Error(`Google Books API error: ${response.status}`);
    }
  }

  throw new Error("Google Books API: max retries exceeded");
}

function getBestCover(imageLinks?: GBVolumeInfo["imageLinks"]): string | null {
  if (!imageLinks) return null;
  // Prefer larger images, upgrade to HTTPS
  const url =
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.small ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail ||
    null;
  return url?.replace("http://", "https://") ?? null;
}

function extractYear(publishedDate?: string): number | null {
  if (!publishedDate) return null;
  const year = parseInt(publishedDate.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}

function volumeToResult(vol: GBVolume): MediaResult {
  return {
    id: vol.id,
    title: vol.volumeInfo.title + (vol.volumeInfo.subtitle ? ` — ${vol.volumeInfo.subtitle}` : ""),
    year: extractYear(vol.volumeInfo.publishedDate),
    coverUrl: getBestCover(vol.volumeInfo.imageLinks),
    type: "bd",
    publisher: vol.volumeInfo.publisher || null,
    author: vol.volumeInfo.authors?.[0] || null,
  };
}

export async function searchBD(query: string): Promise<MediaResult[]> {
  const searchQuery = `${query}+subject:comics`;
  const url = `${GBOOKS_BASE}?q=${encodeURIComponent(searchQuery)}&langRestrict=fr&maxResults=12&orderBy=relevance&printType=books`;

  const response = await throttledFetch(url);

  // Gracefully handle rate limiting - return empty results
  if (!response.ok) {
    return [];
  }

  const data: GBSearchResponse = await response.json();

  if (!data.items || data.totalItems === 0) {
    // Fallback: try without subject filter (with throttle)
    const fallbackUrl = `${GBOOKS_BASE}?q=${encodeURIComponent(query)}&langRestrict=fr&maxResults=12&orderBy=relevance`;
    const fallbackResponse = await throttledFetch(fallbackUrl);
    if (!fallbackResponse.ok) return [];
    const fallbackData: GBSearchResponse = await fallbackResponse.json();
    return (fallbackData.items || []).map(volumeToResult);
  }

  return data.items.map(volumeToResult);
}

export async function getBDDetails(id: string): Promise<MediaDetail> {
  const url = `${GBOOKS_BASE}/${id}`;

  const response = await throttledFetch(url);
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }

  const vol: GBVolume = await response.json();
  const info = vol.volumeInfo;

  // Google Books doesn't have volume-level data like ComicVine,
  // so we provide the single volume itself
  const volumes: VolumeInfo[] = [];
  if (info.pageCount) {
    volumes.push({
      number: 1,
      title: info.title,
      issueId: vol.id,
    });
  }

  return {
    id: vol.id,
    title: info.title + (info.subtitle ? ` — ${info.subtitle}` : ""),
    year: extractYear(info.publishedDate),
    coverUrl: getBestCover(info.imageLinks),
    type: "bd",
    publisher: info.publisher || null,
    author: info.authors?.join(", ") || null,
    description: info.description || null,
    status: info.publishedDate ? `Publié le ${info.publishedDate}` : null,
    volumes,
    chapters: null,
    genres: info.categories || [],
    startDate: info.publishedDate || null,
    endDate: null,
    bannerUrl: null,
  };
}
