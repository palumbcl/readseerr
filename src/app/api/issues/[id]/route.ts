import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getIssueDetail, setIssueStatus } from "@/lib/issues";

type RouteContext = { params: Promise<{ id: string }> };

// GET : signalement et sa discussion (auteur ou admin)
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const issue = await getIssueDetail(user, (await params).id);
  if (!issue) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });
  return NextResponse.json({ issue });
}

// PATCH : { status: "resolved" | "open" }
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body: { status?: string } = await request.json().catch(() => ({}));
  if (body.status !== "resolved" && body.status !== "open") {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const ok = await setIssueStatus(user, (await params).id, body.status);
  if (!ok) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
