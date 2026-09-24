import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { pushUser } from "@/lib/push";

// POST : notification de test sur le sujet ntfy enregistré
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { ntfyTopic: true } });
  if (!stored?.ntfyTopic) {
    return NextResponse.json({ error: "Enregistrez d'abord un sujet ntfy." }, { status: 400 });
  }

  const ok = await pushUser(stored.ntfyTopic, {
    title: "ReadSeerr : notifications activées",
    message: "Vous recevrez ici l'avancement de vos demandes et les nouveautés de vos séries suivies.",
    tags: ["tada"],
  });
  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Le serveur ntfy a refusé la notification." }, { status: 502 });
}
