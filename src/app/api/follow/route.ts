import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { followMedia, listFollows, unfollowMedia } from "@/lib/follows";
import type { RequestPayload } from "@/lib/types";

// GET : séries suivies par l'utilisateur
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json({ follows: await listFollows(user.id) });
}

// PUT : suivre une série (ou changer l'option de demande automatique)
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const body: RequestPayload & { autoRequest?: boolean } = await request.json();
    if (!body.mediaType || !body.externalId || !body.title) {
      return NextResponse.json({ error: "mediaType, externalId et title sont requis." }, { status: 400 });
    }
    if (body.mediaType !== "manga" && body.mediaType !== "comic") {
      return NextResponse.json({ error: "Type de média invalide." }, { status: 400 });
    }

    const follow = await followMedia(user.id, body, Boolean(body.autoRequest));
    return NextResponse.json({ success: true, follow: { autoRequest: follow.autoRequest } });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Impossible de suivre cette série." }, { status: 500 });
  }
}

// DELETE : ne plus suivre (?mediaType=…&externalId=…)
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const mediaType = request.nextUrl.searchParams.get("mediaType");
  const externalId = request.nextUrl.searchParams.get("externalId");
  if (!mediaType || !externalId) {
    return NextResponse.json({ error: "mediaType et externalId sont requis." }, { status: 400 });
  }

  await unfollowMedia(user.id, mediaType, externalId);
  return NextResponse.json({ success: true });
}
