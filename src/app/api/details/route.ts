import { NextRequest, NextResponse } from "next/server";
import { getMangaDetails } from "@/lib/anilist";
import { getComicDetails } from "@/lib/comicvine";
import { detailsCache } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { getDetailAvailability } from "@/lib/media";
import type { DetailAvailability, MediaDetail } from "@/lib/types";

/** État bibliothèque / demandes pour l'utilisateur connecté (null si indisponible) */
async function getState(detail: MediaDetail): Promise<DetailAvailability | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    // Même base que les badges de recherche : nombre de tomes connu à la source
    return await getDetailAvailability(session.user.id, {
      ...detail,
      volumeCount: detail.volumeCount ?? (detail.volumes.length || null),
    });
  } catch (error) {
    console.error("Detail availability error:", error);
    return null;
  }
}

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
  const cached = (await detailsCache.get(cacheKey)) as MediaDetail | null;
  if (cached) {
    return NextResponse.json({ detail: cached, state: await getState(cached) });
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

      default:
        return NextResponse.json(
          { error: "Invalid type. Use 'manga' or 'comic'." },
          { status: 400 }
        );
    }

    // Cache result
    await detailsCache.set(cacheKey, detail);

    return NextResponse.json({ detail, state: await getState(detail) });
  } catch (error) {
    console.error(`Details error [${type}/${id}]:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch details." },
      { status: 500 }
    );
  }
}
