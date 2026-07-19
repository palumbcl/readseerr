import { NextRequest, NextResponse } from "next/server";
import { getMangaDetails } from "@/lib/anilist";
import { getComicDetails } from "@/lib/comicvine";
import { getBDDetails } from "@/lib/googlebooks";
import { getBDDetailsOpenLibrary } from "@/lib/openlibrary";
import { detailsCache } from "@/lib/cache";
import type { MediaDetail } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id || !type) {
    return NextResponse.json(
      { error: "Parameters 'id' and 'type' are required." },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `details:${type}:${id}`;
  const cached = detailsCache.get(cacheKey) as MediaDetail | null;
  if (cached) {
    return NextResponse.json({ detail: cached });
  }

  try {
    let detail: MediaDetail;

    switch (type) {
      case "manga":
        detail = await getMangaDetails(id);
        break;

      case "comic":
        detail = await getComicDetails(id);
        break;

      case "bd":
        // Route to the correct source based on ID prefix
        if (id.startsWith("ol-")) {
          // Open Library result
          detail = await getBDDetailsOpenLibrary(id);
        } else {
          // Google Books result
          detail = await getBDDetails(id);
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid type. Use 'manga', 'comic', or 'bd'." },
          { status: 400 }
        );
    }

    // Cache result
    detailsCache.set(cacheKey, detail);

    return NextResponse.json({ detail });
  } catch (error) {
    console.error(`Details error [${type}/${id}]:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch details." },
      { status: 500 }
    );
  }
}
