import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt-ts";
import { prisma } from "@/lib/prisma";
import { isRegistrationEnabled } from "@/lib/config";
import { isAdminEmail } from "@/lib/roles";
import { sendDiscordNewUserNotification } from "@/lib/discord";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limite contre les créations de comptes en rafale : 5 comptes par adresse IP et par heure.
// Seules les créations réussies comptent : une faute de saisie ne bloque personne.
const creations: Map<string, number[]> = ((globalThis as unknown as { registerCreations?: Map<string, number[]> })
  .registerCreations ??= new Map());

function recentCreations(ip: string): number[] {
  const now = Date.now();
  const recent = (creations.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  creations.set(ip, recent);
  return recent;
}

// POST : { name, email, password } — création d'un compte lecteur
export async function POST(request: NextRequest) {
  if (!isRegistrationEnabled()) {
    return NextResponse.json({ error: "Les inscriptions sont fermées. Contactez l'administrateur." }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (recentCreations(ip).length >= 5) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une heure." }, { status: 429 });
  }

  try {
    const body: { name?: unknown; email?: unknown; password?: unknown } = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json({ error: "Le nom doit faire entre 2 et 50 caractères." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
    }

    // Un email d'administrateur (ADMIN_EMAILS) donnerait les droits admin à qui l'inscrit en premier
    if (isAdminEmail(email) || (await prisma.user.findUnique({ where: { email } }))) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse." },
        { status: 409 }
      );
    }

    await prisma.user.create({ data: { name, email, passwordHash: await hash(password, 12) } });
    recentCreations(ip).push(Date.now());
    await sendDiscordNewUserNotification({ name, email });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
