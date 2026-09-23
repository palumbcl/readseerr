import { NextRequest, NextResponse } from "next/server";
import { getDiscoverRowPage, isDiscoverRowId } from "@/lib/discover";

type RouteContext = { params: Promise<{ row: string }> };

// GET : page complète d'une rangée de Découvrir (?page=N)
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { row } = await params;
  if (!isDiscoverRowId(row)) {
    return NextResponse.json({ error: "Rangée inconnue." }, { status: 404 });
  }

  const page = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1));
  try {
    const result = await getDiscoverRowPage(row, page);
    if (!result) return NextResponse.json({ error: "Source indisponible." }, { status: 503 });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Discover row error [${row}/${page}]:`, error);
    return NextResponse.json({ error: "Impossible de charger cette page pour le moment." }, { status: 500 });
  }
}
