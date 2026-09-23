import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRole, type Role } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Utilisateur connecté, relu en base : le rôle stocké dans le JWT ne sert qu'à l'affichage,
 * les autorisations se basent toujours sur la valeur actuelle (ADMIN_EMAILS compris).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  return user ? { ...user, role: resolveRole(user.role, user.email) } : null;
}

/** Renvoie l'administrateur connecté, ou la réponse d'erreur à retourner telle quelle. */
export async function requireAdmin(): Promise<{ user: CurrentUser; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 }) };
  }
  return { user };
}
