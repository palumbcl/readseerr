import { prisma } from "@/lib/prisma";
import { getQuotaSettings } from "@/lib/settings";
import { parseJsonArray } from "@/lib/titles";
import type { CurrentUser } from "@/lib/permissions";
import type { QuotaStatus } from "@/lib/types";

/** Poids d'une demande : ses tomes, ou 1 pour une œuvre demandée en entier. */
export function requestWeight(volumes: string | number[] | null | undefined): number {
  const list = typeof volumes === "string" || volumes == null ? parseJsonArray<number>(volumes) : volumes;
  return list && list.length > 0 ? list.length : 1;
}

/** Solde du lecteur sur la période glissante (les demandes refusées ne comptent pas). */
export async function getQuotaStatus(user: CurrentUser): Promise<QuotaStatus> {
  const settings = await getQuotaSettings();

  if (user.role === "admin") {
    return { limit: null, days: settings.days, used: 0, remaining: null, resetsAt: null, source: "admin" };
  }

  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { quotaLimit: true } });
  const override = stored?.quotaLimit ?? null;
  const limit = override === -1 ? null : override ?? settings.limit;
  const source = override === null ? "default" : "user";

  const since = new Date(Date.now() - settings.days * 86_400_000);
  const requests = await prisma.request.findMany({
    where: { userId: user.id, createdAt: { gte: since }, status: { not: "declined" } },
    select: { volumes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const used = requests.reduce((sum, r) => sum + requestWeight(r.volumes), 0);

  if (limit === null) {
    return { limit: null, days: settings.days, used, remaining: null, resetsAt: null, source };
  }

  const remaining = Math.max(0, limit - used);
  // Quota atteint : la plus ancienne demande de la période sortira la première de la fenêtre
  const resetsAt =
    remaining === 0 && requests[0]
      ? new Date(requests[0].createdAt.getTime() + settings.days * 86_400_000).toISOString()
      : null;

  return { limit, days: settings.days, used, remaining, resetsAt, source };
}

/** Message d'erreur si `extra` tomes de plus dépassent le quota, null sinon. */
export function quotaError(status: QuotaStatus, extra: number): string | null {
  if (status.limit === null || status.used + extra <= status.limit) return null;

  const unit = (n: number) => `${n} tome${n > 1 ? "s" : ""}`;
  const remaining = status.remaining ?? 0;
  const base = `Quota atteint : ${unit(status.limit)} tous les ${status.days} jours.`;
  if (remaining > 0) return `${base} Il vous reste ${unit(remaining)} : réduisez votre sélection.`;

  const date = status.resetsAt
    ? new Date(status.resetsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;
  return date ? `${base} De nouveaux tomes pourront être demandés à partir du ${date}.` : base;
}
