import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { areRolesManagedByEnv } from "@/lib/roles";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH : changer le rôle ({ role }) et/ou le quota ({ quotaLimit : null = défaut, -1 = illimité, n > 0 })
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  try {
    const body: { role?: string; quotaLimit?: unknown } = await request.json();
    const data: { role?: string; quotaLimit?: number | null } = {};

    if (body.role !== undefined) {
      if (areRolesManagedByEnv()) {
        return NextResponse.json(
          { error: "Les administrateurs sont définis par la variable ADMIN_EMAILS : modifiez-la pour changer les rôles." },
          { status: 409 }
        );
      }
      if (body.role !== "admin" && body.role !== "user") {
        return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
      }
      // Évite de se retirer ses propres droits (et de n'avoir plus aucun admin)
      if (id === admin.id && body.role !== "admin") {
        return NextResponse.json({ error: "Vous ne pouvez pas retirer vos propres droits d'administrateur." }, { status: 400 });
      }
      data.role = body.role;
    }

    if (body.quotaLimit !== undefined) {
      const q = body.quotaLimit;
      if (!(q === null || q === -1 || (Number.isInteger(q) && (q as number) > 0 && (q as number) <= 10_000))) {
        return NextResponse.json({ error: "Quota invalide." }, { status: 400 });
      }
      data.quotaLimit = q as number | null;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, role: true, quotaLimit: true },
    });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Impossible de modifier l'utilisateur." }, { status: 500 });
  }
}
