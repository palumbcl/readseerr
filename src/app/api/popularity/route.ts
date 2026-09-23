import { NextRequest, NextResponse } from "next/server";
import { getComicPopularity } from "@/lib/comic-popularity";

// GET ?q=… : popularité des séries de comics / BD correspondant à la recherche
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ scores: await getComicPopularity(query) });
  } catch (error) {
    // Le tri par popularité reste utilisable : les comics gardent l'ordre de pertinence
    console.error("Comic popularity error:", error);
    return NextResponse.json({ scores: {} });
  }
}
