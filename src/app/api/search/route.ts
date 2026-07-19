import { NextRequest, NextResponse } from "next/server";
import { searchManga } from "@/lib/anilist";
import { searchComics } from "@/lib/comicvine";
import { searchBD } from "@/lib/googlebooks";
import { searchBDOpenLibrary } from "@/lib/openlibrary";
import { searchCache } from "@/lib/cache";
import type { MediaResult } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "manga";

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 2 characters)." },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `search:${type}:${query.toLowerCase().trim()}`;
  const cached = searchCache.get(cacheKey) as MediaResult[] | null;
  if (cached) {
    return NextResponse.json({ results: cached });
  }

  try {
    let results: MediaResult[] = [];

    switch (type) {
      case "manga":
        results = await searchManga(query);
        break;

      case "comic":
        results = await searchComics(query);
        break;

      case "bd": {
        // Strategy: Use both sources in parallel, prefer Google Books but
        // gracefully fall back to Open Library (which has no rate limit)
        const [gbResults, olResults] = await Promise.allSettled([
          searchBD(query),
          searchBDOpenLibrary(query),
        ]);

        const gbData = gbResults.status === "fulfilled" ? gbResults.value : [];
        const olData = olResults.status === "fulfilled" ? olResults.value : [];

        if (gbData.length > 0) {
          // Google Books worked — use it as primary
          results = gbData;
        } else {
          // Google Books failed or empty — use Open Library
          results = olData;
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid type. Use 'manga', 'comic', or 'bd'." },
          { status: 400 }
        );
    }

    // Cache results
    searchCache.set(cacheKey, results);

    return NextResponse.json({ results });
  } catch (error) {
    console.error(`Search error [${type}]:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
