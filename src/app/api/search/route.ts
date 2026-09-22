import { NextRequest, NextResponse } from "next/server";
import { searchManga } from "@/lib/anilist";
import { searchComics } from "@/lib/comicvine";
import { searchBD } from "@/lib/googlebooks";
import { searchBDOpenLibrary } from "@/lib/openlibrary";
import { searchCache } from "@/lib/cache";
import type { MediaResult } from "@/lib/types";

async function searchBDWithFallback(query: string): Promise<MediaResult[]> {
  const [gbResults, olResults] = await Promise.allSettled([
    searchBD(query),
    searchBDOpenLibrary(query),
  ]);
  const gbData = gbResults.status === "fulfilled" ? gbResults.value : [];
  const olData = olResults.status === "fulfilled" ? olResults.value : [];
  return gbData.length > 0 ? gbData : olData;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type"); // optional: "manga" | "comic" | "bd"

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 2 characters)." },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `search:${type || "all"}:${query.toLowerCase().trim()}`;
  const cached = searchCache.get(cacheKey) as MediaResult[] | null;
  if (cached) {
    return NextResponse.json({ results: cached });
  }

  try {
    let results: MediaResult[];

    if (type) {
      // Single-source search (fast, used by autocomplete & progressive loading)
      switch (type) {
        case "manga":
          results = await searchManga(query);
          break;
        case "comic":
          results = await searchComics(query);
          break;
        case "bd":
          results = await searchBDWithFallback(query);
          break;
        default:
          return NextResponse.json(
            { error: "Invalid type. Use 'manga', 'comic', or 'bd'." },
            { status: 400 }
          );
      }
    } else {
      // All-sources search (parallel)
      const [mangaResult, comicResult, bdResult] = await Promise.allSettled([
        searchManga(query),
        searchComics(query),
        searchBDWithFallback(query),
      ]);

      results = [
        ...(mangaResult.status === "fulfilled" ? mangaResult.value : []),
        ...(comicResult.status === "fulfilled" ? comicResult.value : []),
        ...(bdResult.status === "fulfilled" ? bdResult.value : []),
      ];
    }

    // Cache results
    searchCache.set(cacheKey, results);

    return NextResponse.json({ results });
  } catch (error) {
    console.error(`Search error${type ? ` [${type}]` : ""}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}

