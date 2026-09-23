import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { addIssueComment, cleanMessage } from "@/lib/issues";

type RouteContext = { params: Promise<{ id: string }> };

// POST : répondre dans la discussion (auteur ou admin)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body: { message?: unknown } = await request.json().catch(() => ({}));
  const message = cleanMessage(body.message);
  if (!message) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  const ok = await addIssueComment(user, (await params).id, message);
  if (!ok) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
