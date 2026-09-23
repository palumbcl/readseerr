import { NextResponse } from "next/server";
import { getDiscover } from "@/lib/discover";

export async function GET() {
  try {
    return NextResponse.json(await getDiscover());
  } catch (error) {
    console.error("Discover error:", error);
    return NextResponse.json({ error: "Impossible de charger la page Découvrir." }, { status: 500 });
  }
}
