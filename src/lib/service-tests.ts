import nodemailer from "nodemailer";
import { getConfig } from "@/lib/config";
import { isKomgaConfigured } from "@/lib/komga";
import { getNtfyBaseUrl, sendGotify, sendNtfy } from "@/lib/push";

export type TestableService = "komga" | "discord" | "smtp" | "comicvine" | "prowlarr" | "push";
export interface TestResult {
  ok: boolean;
  message: string;
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function testKomga(): Promise<TestResult> {
  const baseUrl = getConfig("komgaUrl")?.replace(/\/$/, "");
  if (!baseUrl) return { ok: false, message: "URL de Komga manquante." };
  if (!isKomgaConfigured()) return { ok: false, message: "Clé API (ou identifiant + mot de passe) manquante." };

  const apiKey = getConfig("komgaApiKey");
  const headers: Record<string, string> = apiKey
    ? { "X-API-Key": apiKey }
    : {
        Authorization: `Basic ${Buffer.from(`${getConfig("komgaUser")}:${getConfig("komgaPassword")}`).toString("base64")}`,
      };

  const response = await fetch(`${baseUrl}/api/v1/libraries`, {
    headers: { ...headers, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: "Komga refuse l'authentification : vérifiez la clé API ou les identifiants." };
  }
  if (!response.ok) return { ok: false, message: `Komga a répondu ${response.status}.` };

  const libraries: { name: string }[] = await response.json();
  return {
    ok: true,
    message: `Connexion réussie : ${libraries.length} bibliothèque(s) (${libraries.map((l) => l.name).join(", ") || "aucune"}).`,
  };
}

async function testDiscord(): Promise<TestResult> {
  const webhookUrl = getConfig("discordWebhookUrl");
  if (!webhookUrl) return { ok: false, message: "URL du webhook Discord manquante." };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        { title: "ReadSeerr : test de notification", description: "Les notifications Discord fonctionnent. ✅", color: 0x6366f1 },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  return response.ok
    ? { ok: true, message: "Message de test envoyé sur Discord." }
    : { ok: false, message: `Discord a refusé le message (${response.status}) : vérifiez l'URL du webhook.` };
}

async function testSmtp(): Promise<TestResult> {
  const host = getConfig("smtpHost");
  const port = parseInt(getConfig("smtpPort") || "", 10);
  const user = getConfig("smtpUser");
  const pass = getConfig("smtpPass");
  if (!host || !port || !user || !pass) {
    return { ok: false, message: "Paramètres SMTP incomplets (serveur, port, utilisateur, mot de passe)." };
  }

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  await transporter.verify();
  // Envoi au compte expéditeur lui-même : adresse forcément valide
  await transporter.sendMail({
    from: `"ReadSeerr" <${user}>`,
    to: user,
    subject: "ReadSeerr : test d'envoi d'email",
    text: "Les emails de ReadSeerr fonctionnent.",
  });
  return { ok: true, message: `Connexion réussie : email de test envoyé à ${user}.` };
}

async function testComicVine(): Promise<TestResult> {
  const key = getConfig("comicvineApiKey");
  if (!key) return { ok: false, message: "Clé API ComicVine manquante." };

  const response = await fetch(
    `https://comicvine.gamespot.com/api/types/?api_key=${encodeURIComponent(key)}&format=json`,
    { headers: { "User-Agent": "ReadSeerr/1.0" }, signal: AbortSignal.timeout(15000) }
  );
  const data = await response.json().catch(() => null);
  if (data?.status_code === 1) return { ok: true, message: "Clé ComicVine valide." };
  if (data?.status_code === 100) return { ok: false, message: "Clé ComicVine invalide." };
  return { ok: false, message: `ComicVine a répondu ${response.status}${data?.error ? ` (${data.error})` : ""}.` };
}

async function testProwlarr(): Promise<TestResult> {
  const url = getConfig("prowlarrUrl");
  if (!url) return { ok: false, message: "URL de Prowlarr manquante." };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    return response.status < 500
      ? { ok: true, message: "Prowlarr répond. Les liens « Chercher sur Prowlarr » pointeront vers cette adresse." }
      : { ok: false, message: `Prowlarr a répondu ${response.status}.` };
  } catch {
    // Adresse du navigateur : le serveur peut ne pas la joindre (réseau Docker, SSO…)
    return {
      ok: true,
      message:
        "Le serveur ne joint pas cette adresse, mais elle ne sert que de lien dans votre navigateur : vérifiez-la en l'ouvrant.",
    };
  }
}

async function testPush(): Promise<TestResult> {
  const topic = getConfig("ntfyAdminTopic");
  const gotify = Boolean(getConfig("gotifyUrl") && getConfig("gotifyToken"));
  if (!topic && !gotify) {
    return { ok: false, message: "Renseignez un sujet ntfy administrateur et/ou Gotify (URL + jeton d'application)." };
  }

  const push = { title: "ReadSeerr : test de notification", message: "Les notifications push fonctionnent. ✅", tags: ["tada"] };
  const [ntfyOk, gotifyOk] = await Promise.all([topic ? sendNtfy(topic, push) : null, gotify ? sendGotify(push) : null]);
  const parts = [
    ntfyOk !== null && (ntfyOk ? `ntfy ✓ (${getNtfyBaseUrl()})` : "ntfy ✕ (serveur injoignable ou jeton refusé)"),
    gotifyOk !== null && (gotifyOk ? "Gotify ✓" : "Gotify ✕ (URL ou jeton d'application refusé)"),
  ].filter(Boolean);
  return { ok: ntfyOk !== false && gotifyOk !== false, message: parts.join(" · ") };
}

const TESTS: Record<TestableService, () => Promise<TestResult>> = {
  push: testPush,
  komga: testKomga,
  discord: testDiscord,
  smtp: testSmtp,
  comicvine: testComicVine,
  prowlarr: testProwlarr,
};

export function isTestableService(value: unknown): value is TestableService {
  return typeof value === "string" && value in TESTS;
}

export async function testService(service: TestableService): Promise<TestResult> {
  try {
    return await TESTS[service]();
  } catch (error) {
    return { ok: false, message: `Échec : ${describeError(error)}` };
  }
}
