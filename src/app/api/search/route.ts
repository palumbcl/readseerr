import { NextRequest, NextResponse } from "next/server";
import { searchManga } from "@/lib/anilist";
import { searchComics } from "@/lib/comicvine";
import { searchBD } from "@/lib/googlebooks";
import { searchBDOpenLibrary } from "@/lib/openlibrary";
import { searchCache } from "@/lib/cache";
import type { MediaResult, SearchPage } from "@/lib/types";

const EMPTY_PAGE: SearchPage = { results: [], hasMore: false };

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** BD: merge Google Books and Open Library, dropping titles already present */
async function searchBDMerged(query: string, page: number): Promise<SearchPage> {
  const [gbResult, olResult] = await Promise.allSettled([
    searchBD(query, page),
    searchBDOpenLibrary(query, page),
  ]);
  const gb = gbResult.status === "fulfilled" ? gbResult.value : EMPTY_PAGE;
  const ol = olResult.status === "fulfilled" ? olResult.value : EMPTY_PAGE;

  const seen = new Set<string>();
  const results: MediaResult[] = [];
  for (const r of [...gb.results, ...ol.results]) {
    const key = normalizeTitle(r.title);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(r);
  }

  // Google Books doesn't report a reliable page count: only known when it has no more pages
  return {
    results,
    hasMore: gb.hasMore || ol.hasMore,
    totalPages: gb.hasMore ? undefined : ol.totalPages,
  };
}

function searchSource(type: string, query: string, page: number): Promise<SearchPage> | null {
  switch (type) {
    case "manga":
      return searchManga(query, page);
    case "comic":
      return searchComics(query, page);
    case "bd":
      return searchBDMerged(query, page);
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type"); // optional: "manga" | "comic" | "bd"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 2 characters)." },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `search:${type || "all"}:${page}:${query.toLowerCase().trim()}`;
  const cached = searchCache.get(cacheKey) as SearchPage | null;
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    let result: SearchPage;

    if (type) {
      // Single-source search (used by autocomplete & progressive loading)
      const pending = searchSource(type, query, page);
      if (!pending) {
        return NextResponse.json(
          { error: "Invalid type. Use 'manga', 'comic', or 'bd'." },
          { status: 400 }
        );
      }
      result = await pending;
    } else {
      // All-sources search (parallel)
      const pages = await Promise.allSettled([
        searchManga(query, page),
        searchComics(query, page),
        searchBDMerged(query, page),
      ]);
      const fulfilled = pages.map((p) => (p.status === "fulfilled" ? p.value : EMPTY_PAGE));

      result = {
        results: fulfilled.flatMap((p) => p.results),
        hasMore: fulfilled.some((p) => p.hasMore),
      };
    }

    // Cache results
    searchCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Search error${type ? ` [${type}]` : ""}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
