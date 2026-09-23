import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { isTestableService, testService } from "@/lib/service-tests";

// POST : { service } — teste la connexion avec les paramètres enregistrés
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body: { service?: unknown } = await request.json().catch(() => ({}));
  if (!isTestableService(body.service)) {
    return NextResponse.json({ error: "Service inconnu." }, { status: 400 });
  }
  return NextResponse.json(await testService(body.service));
}
