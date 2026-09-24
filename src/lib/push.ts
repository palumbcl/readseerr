import { getConfig } from "@/lib/config";

/**
 * Notifications push : ntfy (admin + lecteurs, chacun sur son sujet) et Gotify (admin).
 * Un échec d'envoi est journalisé mais ne bloque jamais l'action qui l'a déclenché.
 */
export interface PushMessage {
  title: string;
  message: string;
  /** Adresse ouverte au clic sur la notification */
  click?: string | null;
  /** 1 (min) à 5 (urgent), 3 par défaut */
  priority?: number;
  /** Émojis / étiquettes ntfy (ex. "books", "white_check_mark") */
  tags?: string[];
}

/** Sujet ntfy valide : lettres, chiffres, tiret, souligné (1 à 64 caractères). */
export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function getNtfyBaseUrl(): string {
  return (getConfig("ntfyUrl") || "https://ntfy.sh").replace(/\/$/, "");
}

/** Envoie sur un sujet ntfy ; renvoie true si le serveur a accepté le message. */
export async function sendNtfy(topic: string, push: PushMessage): Promise<boolean> {
  if (!NTFY_TOPIC_PATTERN.test(topic)) return false;
  const token = getConfig("ntfyToken");
  try {
    const response = await fetch(getNtfyBaseUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({
        topic,
        title: push.title.slice(0, 250),
        message: push.message.slice(0, 3500),
        priority: push.priority ?? 3,
        tags: push.tags,
        ...(push.click && { click: push.click }),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error(`ntfy a répondu ${response.status} :`, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Erreur réseau (ntfy):", error);
    return false;
  }
}

/** Envoie sur Gotify (jeton d'application configuré par l'admin). */
export async function sendGotify(push: PushMessage): Promise<boolean> {
  const baseUrl = getConfig("gotifyUrl")?.replace(/\/$/, "");
  const token = getConfig("gotifyToken");
  if (!baseUrl || !token) return false;
  try {
    const response = await fetch(`${baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Gotify-Key": token },
      body: JSON.stringify({
        title: push.title.slice(0, 250),
        message: push.message,
        // Gotify : priorité 0-10, notification Android sonore à partir de 5
        priority: Math.min(10, (push.priority ?? 3) * 2),
        ...(push.click && { extras: { "client::notification": { click: { url: push.click } } } }),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error(`Gotify a répondu ${response.status} :`, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Erreur réseau (Gotify):", error);
    return false;
  }
}

/** Notification de l'administrateur : sujet ntfy admin et/ou Gotify, selon ce qui est configuré. */
export async function pushAdmin(push: PushMessage): Promise<void> {
  const adminTopic = getConfig("ntfyAdminTopic");
  await Promise.all([adminTopic ? sendNtfy(adminTopic, push) : false, sendGotify(push)]);
}

/** Notification d'un lecteur, sur son sujet ntfy personnel s'il en a défini un. */
export async function pushUser(topic: string | null | undefined, push: PushMessage): Promise<boolean> {
  return topic ? sendNtfy(topic, push) : false;
}

/** « [Voir sur AniList](https://…) » -> « Voir sur AniList », pour les messages texte. */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");
}
