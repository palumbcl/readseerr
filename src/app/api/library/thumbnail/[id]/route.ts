import { NextRequest, NextResponse } from "next/server";
import { fetchKomgaSeriesThumbnail } from "@/lib/komga";

type RouteContext = { params: Promise<{ id: string }> };

// Couverture Komga relayée côté serveur : le navigateur n'a pas la clé API Komga
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const upstream = await fetchKomgaSeriesThumbnail(id);
    if (!upstream) return new NextResponse(null, { status: 404 });

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error(`Komga thumbnail error [${id}]:`, error);
    return new NextResponse(null, { status: 502 });
  }
}
