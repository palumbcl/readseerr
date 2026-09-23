import { prisma } from "@/lib/prisma";
import type { QuotaSettings } from "@/lib/types";

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.value) };
  } catch {
    return fallback;
  }
}

async function setSetting<T>(key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

/** Quota désactivé tant que l'admin ne l'a pas réglé */
const DEFAULT_QUOTA: QuotaSettings = { limit: null, days: 7 };

export function getQuotaSettings(): Promise<QuotaSettings> {
  return getSetting("quota", DEFAULT_QUOTA);
}

export function setQuotaSettings(value: QuotaSettings): Promise<void> {
  return setSetting("quota", value);
}
