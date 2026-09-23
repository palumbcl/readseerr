import { NextRequest, NextResponse } from "next/server";
import { searchManga, searchMangaByAuthor } from "@/lib/anilist";
import { searchComics, searchComicsByAuthor } from "@/lib/comicvine";
import { searchCache } from "@/lib/cache";
import { annotateAvailability } from "@/lib/library";
import type { SearchPage } from "@/lib/types";

const EMPTY_PAGE: SearchPage = { results: [], hasMore: false };

async function withAvailability(page: SearchPage): Promise<SearchPage> {
  try {
    return { ...page, results: await annotateAvailability(page.results) };
  } catch (error) {
    // Les badges sont un bonus : la recherche doit fonctionner même si la base est indisponible
    console.error("Availability annotation error:", error);
    return page;
  }
}

/** Œuvres des auteurs dont le nom correspond à la recherche (une seule page). */
async function searchByAuthor(type: string, query: string): Promise<SearchPage | null> {
  const search = type === "manga" ? searchMangaByAuthor : type === "comic" ? searchComicsByAuthor : null;
  if (!search) return null;
  const { authors, results } = await search(query);
  return { results, hasMore: false, authors };
}

function searchSource(type: string, query: string, page: number): Promise<SearchPage> | null {
  switch (type) {
    case "manga":
      return searchManga(query, page);
    case "comic":
      return searchComics(query, page);
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type"); // optional: "manga" | "comic"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 2 characters)." },
      { status: 400 }
    );
  }

  // Recherche par auteur (?author=1) : œuvres des mangakas / auteurs correspondants
  if (searchParams.get("author") === "1") {
    // Version dans la clé : invalide les résultats calculés avec une ancienne règle de classement
    const authorKey = `author-v2:${type}:${query.toLowerCase().trim()}`;
    try {
      const cachedAuthor = (await searchCache.get(authorKey)) as SearchPage | null;
      if (cachedAuthor) return NextResponse.json(await withAvailability(cachedAuthor));
      const result = await searchByAuthor(type ?? "", query.trim());
      if (!result) return NextResponse.json({ error: "Invalid type. Use 'manga' or 'comic'." }, { status: 400 });
      await searchCache.set(authorKey, result);
      return NextResponse.json(await withAvailability(result));
    } catch (error) {
      // Recherche secondaire : un échec ne doit jamais bloquer les résultats par titre
      console.error(`Author search error [${type}]:`, error);
      return NextResponse.json(EMPTY_PAGE);
    }
  }

  // Check cache
  const cacheKey = `search:${type || "all"}:${page}:${query.toLowerCase().trim()}`;
  const cached = (await searchCache.get(cacheKey)) as SearchPage | null;
  if (cached) {
    return NextResponse.json(await withAvailability(cached));
  }

  try {
    let result: SearchPage;

    if (type) {
      // Single-source search (used by autocomplete & progressive loading)
      const pending = searchSource(type, query, page);
      if (!pending) {
        return NextResponse.json(
          { error: "Invalid type. Use 'manga' or 'comic'." },
          { status: 400 }
        );
      }
      result = await pending;
    } else {
      // All-sources search (parallel)
      const pages = await Promise.allSettled([
        searchManga(query, page),
        searchComics(query, page),
      ]);
      const fulfilled = pages.map((p) => (p.status === "fulfilled" ? p.value : EMPTY_PAGE));

      result = {
        results: fulfilled.flatMap((p) => p.results),
        hasMore: fulfilled.some((p) => p.hasMore),
      };
    }

    // Cache results (sans la disponibilité, qui change à chaque demande ou ajout dans Komga)
    await searchCache.set(cacheKey, result);

    return NextResponse.json(await withAvailability(result));
  } catch (error) {
    console.error(`Search error${type ? ` [${type}]` : ""}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
