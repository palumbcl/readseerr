import type { MediaType } from "@/lib/types";
import type { KomgaSeriesMatch } from "@/lib/komga";
import { getConfig } from "@/lib/config";
import { pushAdmin, stripMarkdownLinks } from "@/lib/push";

const TYPE_STYLES: Record<MediaType, { label: string; color: number }> = {
  manga: { label: "🇯🇵 Manga", color: 0xe11d48 },
  comic: { label: "📘 Comic / BD", color: 0x2563eb },
};

const AVAILABLE_COLOR = 0x22c55e;

const STATUS_LABELS: Record<string, string> = {
  pending: "en attente",
  approved: "acceptée",
  declined: "refusée",
  available: "disponible",
};

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

/** Une demande antérieure portant sur la même œuvre. */
export interface PreviousRequest {
  userName: string;
  status: string;
  createdAt: Date;
}

/** Lien vers la fiche de l'œuvre chez la source d'origine. */
export function getSourceLink(mediaType: MediaType, externalId: string): { name: string; url: string } | null {
  switch (mediaType) {
    case "manga":
      return { name: "AniList", url: `https://anilist.co/manga/${externalId}` };
    case "comic":
      return { name: "ComicVine", url: `https://comicvine.gamespot.com/volume/4050-${externalId}/` };
    default:
      return null;
  }
}

function getAppUrl(): string | undefined {
  return (process.env.NEXTAUTH_URL || process.env.AUTH_URL)?.replace(/\/$/, "");
}

function getAppLink(mediaType: MediaType, externalId: string): string | undefined {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}/details/${mediaType}/${encodeURIComponent(externalId)}` : undefined;
}

/** Ouvre la page de recherche Prowlarr pré-remplie avec le titre. */
export function getProwlarrSearchLink(title: string): string | undefined {
  const prowlarrUrl = getConfig("prowlarrUrl")?.replace(/\/$/, "");
  return prowlarrUrl ? `${prowlarrUrl}/search?query=${encodeURIComponent(title)}` : undefined;
}

/** [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8" */
function formatVolumes(volumes: number[]): string {
  const sorted = [...new Set(volumes)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (const n of [...sorted.slice(1), Infinity]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }

  return ranges.join(", ");
}

/** Discord n'accepte que des URLs http(s) absolues pour les images. */
function toHttpsUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return url.startsWith("https://") ? url : undefined;
}

/** Garde un champ sous la limite Discord de 1024 caractères. */
function truncate(value: string, max = 1024): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  fields?: EmbedField[];
  // Autres propriétés Discord (couleur, image, pied de page…), transmises telles quelles
  [key: string]: unknown;
}

/** Même alerte en notification push (ntfy / Gotify) : titre, description et champs en texte. */
async function pushEmbed(embed: DiscordEmbed | undefined) {
  if (!embed?.title) return;
  const lines = [
    embed.description,
    ...(embed.fields ?? []).filter((f) => f.name !== "Liens").map((f) => `${f.name} : ${f.value}`),
  ].filter(Boolean) as string[];
  const appUrl = getAppUrl();
  await pushAdmin({
    title: embed.title,
    message: stripMarkdownLinks(lines.join("\n")),
    click: appUrl ? `${appUrl}/admin` : embed.url,
    tags: ["books"],
  });
}

/** Alerte de l'administrateur : Discord et, si configurés, ntfy / Gotify. */
async function postToDiscord(payload: { embeds?: DiscordEmbed[] }) {
  await pushEmbed(payload.embeds?.[0]).catch((error) => console.error("Notification push échouée:", error));

  const webhookUrl = getConfig("discordWebhookUrl");

  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Erreur lors de l'envoi de la notification Discord:", await response.text());
    } else {
      console.log("Notification Discord envoyée avec succès.");
    }
  } catch (error) {
    console.error("Erreur réseau (Discord webhook):", error);
  }
}

export async function sendDiscordNotification({
  title,
  mediaType,
  externalId,
  coverUrl,
  volumes,
  year,
  publisher,
  author,
  userName,
  previousRequests = [],
  komgaMatches = null,
  automatic = false,
}: {
  title: string;
  mediaType: MediaType;
  externalId: string;
  coverUrl?: string | null;
  volumes?: number[] | null;
  year?: number | null;
  publisher?: string | null;
  author?: string | null;
  userName?: string | null;
  previousRequests?: PreviousRequest[];
  /** null = Komga non configuré ou injoignable */
  komgaMatches?: KomgaSeriesMatch[] | null;
  /** Demande créée par le suivi de série (nouveaux numéros parus) */
  automatic?: boolean;
}) {
  const { label: typeLabel, color } = TYPE_STYLES[mediaType] ?? TYPE_STYLES.comic;

  const appLink = getAppLink(mediaType, externalId);
  const sourceLink = getSourceLink(mediaType, externalId);
  const prowlarrLink = getProwlarrSearchLink(title);

  const fields: EmbedField[] = [
    { name: "Titre", value: truncate(title), inline: true },
    { name: "Type", value: typeLabel, inline: true },
  ];

  if (year) fields.push({ name: "Année", value: String(year), inline: true });
  if (author) fields.push({ name: "Auteur", value: truncate(author), inline: true });
  if (publisher) fields.push({ name: "Éditeur", value: truncate(publisher), inline: true });

  fields.push({
    name: "Tomes demandés",
    value: volumes && volumes.length > 0 ? truncate(formatVolumes(volumes)) : "Tous / non précisé",
    inline: false,
  });

  fields.push({ name: "Demandé par", value: userName || "Utilisateur inconnu", inline: false });

  // Avertissements de doublons : même œuvre déjà demandée, ou série déjà dans Komga
  if (previousRequests.length > 0) {
    const lines = previousRequests
      .slice(0, 5)
      .map((req) => `• ${req.userName} le ${formatDate(req.createdAt)} (${STATUS_LABELS[req.status] ?? req.status})`);
    if (previousRequests.length > 5) lines.push(`• … et ${previousRequests.length - 5} autre(s)`);
    fields.push({ name: "⚠️ Déjà demandé", value: truncate(lines.join("\n")), inline: false });
  }

  if (komgaMatches && komgaMatches.length > 0) {
    const lines = komgaMatches.map(
      (series) => `• [${series.name}](${series.url}) — ${series.booksCount} tome(s)`
    );
    fields.push({ name: "📚 Peut-être déjà dans Komga", value: truncate(lines.join("\n")), inline: false });
  }

  const adminLink = getAppUrl() && `${getAppUrl()}/admin`;
  const links = [
    prowlarrLink && `[🔎 Chercher sur Prowlarr](${prowlarrLink})`,
    adminLink && `[✅ Accepter / refuser](${adminLink})`,
    appLink && `[Fiche ReadSeerr](${appLink})`,
    sourceLink && `[Voir sur ${sourceLink.name}](${sourceLink.url})`,
  ].filter(Boolean);
  if (links.length > 0) {
    fields.push({ name: "Liens", value: links.join(" • "), inline: false });
  }

  const imageUrl = toHttpsUrl(coverUrl);

  await postToDiscord({
    embeds: [
      {
        title: `${automatic ? "Demande automatique" : "Nouvelle demande"} : ${title}`.slice(0, 256),
        url: sourceLink?.url ?? appLink,
        description: automatic
          ? "De nouveaux numéros sont parus pour une série suivie : demande créée automatiquement."
          : "Une nouvelle demande a été ajoutée à la liste de souhaits.",
        color,
        fields,
        ...(imageUrl && { image: { url: imageUrl } }),
        footer: {
          text: `ID ${sourceLink?.name ?? "source"} : ${externalId} • Va sur Prowlarr pour lancer le téléchargement ! 🏴‍☠️`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Prévient l'admin qu'une demande a été satisfaite par un ajout dans Komga. */
export async function sendDiscordAvailableNotification({
  title,
  mediaType,
  coverUrl,
  komgaSeriesName,
  userNames,
  emailedCount,
}: {
  title: string;
  mediaType: MediaType;
  coverUrl?: string | null;
  komgaSeriesName: string;
  userNames: string[];
  emailedCount: number;
}) {
  const { label: typeLabel } = TYPE_STYLES[mediaType] ?? TYPE_STYLES.comic;
  const thumbnailUrl = toHttpsUrl(coverUrl);

  await postToDiscord({
    embeds: [
      {
        title: `Demande disponible : ${title}`.slice(0, 256),
        description: `La série **${komgaSeriesName}** a été ajoutée dans Komga.`,
        color: AVAILABLE_COLOR,
        fields: [
          { name: "Type", value: typeLabel, inline: true },
          { name: "Demandeur(s)", value: truncate(userNames.join(", ") || "Inconnu"), inline: true },
          {
            name: "Utilisateurs prévenus par email",
            value: `${emailedCount} / ${userNames.length}`,
            inline: true,
          },
        ],
        ...(thumbnailUrl && { thumbnail: { url: thumbnailUrl } }),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

const CANCELLED_COLOR = 0x6b7280;
const UPDATED_COLOR = 0xf59e0b;

/** Prévient l'admin qu'un utilisateur a modifié ou retiré sa demande. */
export async function sendDiscordRequestChangeNotification({
  action,
  title,
  mediaType,
  coverUrl,
  previousVolumes,
  volumes,
  userName,
}: {
  action: "updated" | "cancelled";
  title: string;
  mediaType: MediaType;
  coverUrl?: string | null;
  previousVolumes?: number[] | null;
  volumes?: number[] | null;
  userName?: string | null;
}) {
  const { label: typeLabel } = TYPE_STYLES[mediaType] ?? TYPE_STYLES.comic;
  const thumbnailUrl = toHttpsUrl(coverUrl);
  const describeVolumes = (list?: number[] | null) =>
    list && list.length > 0 ? truncate(formatVolumes(list)) : "Tous / non précisé";

  const fields: EmbedField[] = [
    { name: "Type", value: typeLabel, inline: true },
    { name: "Utilisateur", value: userName || "Utilisateur inconnu", inline: true },
  ];

  if (action === "updated") {
    fields.push(
      { name: "Avant", value: describeVolumes(previousVolumes), inline: false },
      { name: "Après", value: describeVolumes(volumes), inline: false }
    );
  } else {
    fields.push({ name: "Tomes qui étaient demandés", value: describeVolumes(previousVolumes), inline: false });
  }

  await postToDiscord({
    embeds: [
      {
        title: `${action === "updated" ? "Demande modifiée" : "Demande retirée"} : ${title}`.slice(0, 256),
        description:
          action === "updated"
            ? "L'utilisateur a changé les tomes demandés."
            : "L'utilisateur a retiré sa demande, inutile de la traiter.",
        color: action === "updated" ? UPDATED_COLOR : CANCELLED_COLOR,
        fields,
        ...(thumbnailUrl && { thumbnail: { url: thumbnailUrl } }),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

const ISSUE_COLOR = 0xef4444;

/** Prévient l'admin d'un nouveau signalement ou d'une réponse d'un lecteur. */
export async function sendDiscordIssueNotification({
  kind,
  title,
  mediaType,
  coverUrl,
  typeLabel,
  volume,
  message,
  userName,
  issueId,
}: {
  kind: "new" | "comment";
  title: string;
  mediaType: MediaType;
  coverUrl?: string | null;
  typeLabel: string;
  volume?: number | null;
  message: string;
  userName: string;
  issueId: string;
}) {
  const appUrl = getAppUrl();
  const fields: EmbedField[] = [
    { name: "Type", value: (TYPE_STYLES[mediaType] ?? TYPE_STYLES.comic).label, inline: true },
    { name: "Problème", value: typeLabel, inline: true },
    ...(volume ? [{ name: "Tome", value: String(volume), inline: true }] : []),
    { name: kind === "new" ? "Signalé par" : "Réponse de", value: userName, inline: true },
    { name: "Message", value: truncate(message), inline: false },
  ];
  if (appUrl) {
    fields.push({ name: "Liens", value: `[💬 Répondre](${appUrl}/issues/${issueId})`, inline: false });
  }

  const thumbnailUrl = toHttpsUrl(coverUrl);
  await postToDiscord({
    embeds: [
      {
        title: `${kind === "new" ? "Problème signalé" : "Nouvelle réponse"} : ${title}`.slice(0, 256),
        color: ISSUE_COLOR,
        fields,
        ...(thumbnailUrl && { thumbnail: { url: thumbnailUrl } }),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
