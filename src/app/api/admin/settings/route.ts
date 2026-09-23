import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { getQuotaSettings, setQuotaSettings } from "@/lib/settings";

// GET : réglages modifiables depuis l'interface
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ quota: await getQuotaSettings() });
}

// PUT : { quota: { limit: number | null, days: number } }
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body: { quota?: { limit?: unknown; days?: unknown } } = await request.json().catch(() => ({}));
  const limit = body.quota?.limit;
  const days = body.quota?.days;

  if (limit !== null && !(Number.isInteger(limit) && (limit as number) > 0 && (limit as number) <= 10_000)) {
    return NextResponse.json({ error: "Nombre de tomes invalide (vide = illimité)." }, { status: 400 });
  }
  if (!(Number.isInteger(days) && (days as number) >= 1 && (days as number) <= 365)) {
    return NextResponse.json({ error: "Période invalide (1 à 365 jours)." }, { status: 400 });
  }

  const quota = { limit: limit as number | null, days: days as number };
  await setQuotaSettings(quota);
  return NextResponse.json({ quota });
}
