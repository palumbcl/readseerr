import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { areRolesManagedByEnv } from "@/lib/roles";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH : changer le rôle d'un compte
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  if (areRolesManagedByEnv()) {
    return NextResponse.json(
      { error: "Les administrateurs sont définis par la variable ADMIN_EMAILS : modifiez-la pour changer les rôles." },
      { status: 409 }
    );
  }

  try {
    const body: { role?: string } = await request.json();
    if (body.role !== "admin" && body.role !== "user") {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }

    // Évite de se retirer ses propres droits (et de n'avoir plus aucun admin)
    if (id === admin.id && body.role !== "admin") {
      return NextResponse.json({ error: "Vous ne pouvez pas retirer vos propres droits d'administrateur." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: { id: true, role: true },
    });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Impossible de modifier l'utilisateur." }, { status: 500 });
  }
}
