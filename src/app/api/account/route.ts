import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { getNtfyBaseUrl, NTFY_TOPIC_PATTERN } from "@/lib/push";

// GET : préférences de notification de l'utilisateur
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { ntfyTopic: true } });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    ntfyTopic: stored?.ntfyTopic ?? null,
    ntfyServer: getNtfyBaseUrl(),
  });
}

// PUT : { ntfyTopic: string | null }
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body: { ntfyTopic?: unknown } = await request.json().catch(() => ({}));
  const topic = typeof body.ntfyTopic === "string" ? body.ntfyTopic.trim() : "";
  if (topic && !NTFY_TOPIC_PATTERN.test(topic)) {
    return NextResponse.json(
      { error: "Sujet invalide : lettres, chiffres, « - » et « _ » uniquement (64 caractères max)." },
      { status: 400 }
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { ntfyTopic: topic || null } });
  return NextResponse.json({ success: true, ntfyTopic: topic || null });
}
