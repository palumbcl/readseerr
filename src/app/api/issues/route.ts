import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { cleanMessage, createIssue, ISSUE_TYPES, listIssues } from "@/lib/issues";
import type { IssueStatus, IssueType, RequestPayload } from "@/lib/types";

// GET : mes signalements, ou tous (?scope=all, admin) ; ?status=open|resolved
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const scopeAll = request.nextUrl.searchParams.get("scope") === "all";
  if (scopeAll && user.role !== "admin") {
    return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  }
  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam === "open" || statusParam === "resolved" ? (statusParam as IssueStatus) : undefined;

  return NextResponse.json(await listIssues({ userId: scopeAll ? undefined : user.id, status }));
}

// POST : signaler un problème sur une œuvre
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const body: RequestPayload & { type?: IssueType; volume?: number | null; message?: string } = await request.json();
    const message = cleanMessage(body.message);

    if (!body.mediaType || !body.externalId || !body.title) {
      return NextResponse.json({ error: "Œuvre manquante." }, { status: 400 });
    }
    if (!body.type || !ISSUE_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Type de problème invalide." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Décrivez le problème en quelques mots." }, { status: 400 });
    }

    const issue = await createIssue(user, { ...body, type: body.type, message });
    return NextResponse.json({ success: true, issue });
  } catch (error) {
    console.error("Issue create error:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer le signalement." }, { status: 500 });
  }
}
