import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { areRolesManagedByEnv, resolveRole } from "@/lib/roles";

// GET : comptes et nombre de demandes par statut
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [users, grouped] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          passwordHash: true,
          accounts: { select: { provider: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.request.groupBy({ by: ["userId", "status"], _count: true }),
    ]);

    return NextResponse.json({
      rolesManagedByEnv: areRolesManagedByEnv(),
      users: users.map(({ passwordHash, accounts, ...user }) => {
        const counts = grouped.filter((g) => g.userId === user.id);
        return {
          ...user,
          role: resolveRole(user.role, user.email),
          createdAt: user.createdAt.toISOString(),
          providers: [...(passwordHash ? ["local"] : []), ...accounts.map((a) => a.provider)],
          requestCount: counts.reduce((sum, g) => sum + g._count, 0),
          openRequestCount: counts
            .filter((g) => g.status === "pending" || g.status === "approved")
            .reduce((sum, g) => sum + g._count, 0),
        };
      }),
    });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "Impossible de charger les utilisateurs." }, { status: 500 });
  }
}
