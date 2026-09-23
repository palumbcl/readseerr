import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getQuotaStatus } from "@/lib/quota";

// GET : solde de demandes de l'utilisateur connecté
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json(await getQuotaStatus(user));
}
