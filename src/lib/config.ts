import { prisma } from "@/lib/prisma";

/**
 * Paramètres des services modifiables depuis /admin.
 * Une valeur saisie dans l'interface l'emporte ; sinon la variable d'environnement s'applique.
 * L'authentification (NEXTAUTH_*, Authelia), ADMIN_EMAILS et la base restent en variables d'environnement.
 */
export const CONFIG_FIELDS = {
  komgaUrl: { env: "KOMGA_URL", secret: false },
  komgaPublicUrl: { env: "KOMGA_PUBLIC_URL", secret: false },
  komgaApiKey: { env: "KOMGA_API_KEY", secret: true },
  komgaUser: { env: "KOMGA_USER", secret: false },
  komgaPassword: { env: "KOMGA_PASSWORD", secret: true },
  komgaWebhookSecret: { env: "KOMGA_WEBHOOK_SECRET", secret: true },
  komgaSyncIntervalMinutes: { env: "KOMGA_SYNC_INTERVAL_MINUTES", secret: false },
  komgaLoginEnabled: { env: "KOMGA_LOGIN_ENABLED", secret: false }, // "true" : connexion avec un compte Komga
  registrationEnabled: { env: "REGISTRATION_ENABLED", secret: false }, // "false" : inscriptions fermées
  discordWebhookUrl: { env: "DISCORD_WEBHOOK_URL", secret: true },
  prowlarrUrl: { env: "PROWLARR_URL", secret: false },
  ntfyUrl: { env: "NTFY_URL", secret: false }, // https://ntfy.sh par défaut
  ntfyAdminTopic: { env: "NTFY_ADMIN_TOPIC", secret: true }, // un sujet ntfy public se devine : traité comme un secret
  ntfyToken: { env: "NTFY_TOKEN", secret: true },
  gotifyUrl: { env: "GOTIFY_URL", secret: false },
  gotifyToken: { env: "GOTIFY_TOKEN", secret: true },
  smtpHost: { env: "SMTP_HOST", secret: false },
  smtpPort: { env: "SMTP_PORT", secret: false },
  smtpUser: { env: "SMTP_USER", secret: false },
  smtpPass: { env: "SMTP_PASS", secret: true },
  comicvineApiKey: { env: "COMICVINE_API_KEY", secret: true },
} as const;

export type ConfigKey = keyof typeof CONFIG_FIELDS;
export type ConfigSource = "ui" | "env" | "none";

const SETTING_KEY = "config";

// Sur globalThis : partagé entre l'instrumentation et les routes (instances de module distinctes)
const shared = globalThis as unknown as { readseerrConfig?: Partial<Record<ConfigKey, string>> };

/** Charge les valeurs saisies dans l'interface (au démarrage, puis après chaque enregistrement). */
export async function loadConfig(): Promise<void> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  try {
    shared.readseerrConfig = row ? JSON.parse(row.value) : {};
  } catch {
    shared.readseerrConfig = {};
  }
}

/** Valeur effective d'un paramètre (interface, sinon variable d'environnement). */
export function getConfig(key: ConfigKey): string | undefined {
  const fromUi = shared.readseerrConfig?.[key];
  if (fromUi) return fromUi;
  const fromEnv = process.env[CONFIG_FIELDS[key].env];
  return fromEnv || undefined;
}

export function getConfigSource(key: ConfigKey): ConfigSource {
  if (shared.readseerrConfig?.[key]) return "ui";
  return process.env[CONFIG_FIELDS[key].env] ? "env" : "none";
}

/**
 * Enregistre des valeurs saisies dans l'interface.
 * `null` ou chaîne vide supprime la valeur (retour à la variable d'environnement) ;
 * un secret absent du patch est conservé tel quel.
 */
export async function saveConfig(patch: Partial<Record<ConfigKey, string | null>>): Promise<void> {
  await loadConfig();
  const next = { ...shared.readseerrConfig };
  for (const [key, value] of Object.entries(patch) as [ConfigKey, string | null][]) {
    if (!(key in CONFIG_FIELDS)) continue;
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }

  const json = JSON.stringify(next);
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: json },
    update: { value: json },
  });
  shared.readseerrConfig = next;
}

/** Vue pour l'interface : jamais de secret en clair. */
export function describeConfig(): Record<ConfigKey, { value: string; source: ConfigSource; secret: boolean; set: boolean }> {
  const result = {} as Record<ConfigKey, { value: string; source: ConfigSource; secret: boolean; set: boolean }>;
  for (const key of Object.keys(CONFIG_FIELDS) as ConfigKey[]) {
    const { secret } = CONFIG_FIELDS[key];
    const value = getConfig(key);
    result[key] = {
      value: secret ? "" : value ?? "",
      source: getConfigSource(key),
      secret,
      set: Boolean(value),
    };
  }
  return result;
}

/** Inscriptions ouvertes, sauf si l'admin les a fermées (Paramètres ou REGISTRATION_ENABLED=false). */
export function isRegistrationEnabled(): boolean {
  return getConfig("registrationEnabled") !== "false";
}
