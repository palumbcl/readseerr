import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { CONFIG_FIELDS, describeConfig, saveConfig, type ConfigKey } from "@/lib/config";
import { getQuotaSettings, setQuotaSettings } from "@/lib/settings";

const URL_KEYS: ConfigKey[] = ["komgaUrl", "komgaPublicUrl", "prowlarrUrl", "discordWebhookUrl"];

// GET : réglages modifiables depuis l'interface (secrets jamais renvoyés)
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ quota: await getQuotaSettings(), config: describeConfig() });
}

// PUT : { quota?: { limit, days }, config?: { clé: valeur | null } }
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body: { quota?: { limit?: unknown; days?: unknown }; config?: Record<string, unknown> } = await request
    .json()
    .catch(() => ({}));

  if (body.quota) {
    const { limit, days } = body.quota;
    if (limit !== null && !(Number.isInteger(limit) && (limit as number) > 0 && (limit as number) <= 10_000)) {
      return NextResponse.json({ error: "Nombre de tomes invalide (vide = illimité)." }, { status: 400 });
    }
    if (!(Number.isInteger(days) && (days as number) >= 1 && (days as number) <= 365)) {
      return NextResponse.json({ error: "Période invalide (1 à 365 jours)." }, { status: 400 });
    }
    await setQuotaSettings({ limit: limit as number | null, days: days as number });
  }

  if (body.config) {
    const patch: Partial<Record<ConfigKey, string | null>> = {};
    for (const [key, value] of Object.entries(body.config)) {
      if (!(key in CONFIG_FIELDS)) continue;
      if (value !== null && typeof value !== "string") {
        return NextResponse.json({ error: `Valeur invalide pour ${key}.` }, { status: 400 });
      }
      patch[key as ConfigKey] = value as string | null;
    }

    for (const key of URL_KEYS) {
      const candidate = patch[key]?.trim();
      if (candidate && !/^https?:\/\//i.test(candidate)) {
        return NextResponse.json(
          { error: `Adresse invalide : « ${candidate} » (http:// ou https:// attendu).` },
          { status: 400 }
        );
      }
    }
    const interval = patch.komgaSyncIntervalMinutes?.trim();
    if (interval && !(Number.isInteger(Number(interval)) && Number(interval) >= 5 && Number(interval) <= 1440)) {
      return NextResponse.json({ error: "Intervalle de synchronisation invalide (5 à 1440 minutes)." }, { status: 400 });
    }
    const port = patch.smtpPort?.trim();
    if (port && !(Number.isInteger(Number(port)) && Number(port) > 0 && Number(port) < 65536)) {
      return NextResponse.json({ error: "Port SMTP invalide." }, { status: 400 });
    }

    await saveConfig(patch);
  }

  return NextResponse.json({ quota: await getQuotaSettings(), config: describeConfig() });
}
