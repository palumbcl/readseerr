import type { MediaType } from "@/lib/types";
import type { KomgaSeriesMatch } from "@/lib/komga";

const TYPE_STYLES: Record<MediaType, { label: string; color: number }> = {
  manga: { label: "🇯🇵 Manga", color: 0xe11d48 },
  comic: { label: "🇺🇸 Comic", color: 0x2563eb },
  bd: { label: "🇫🇷 BD", color: 0x6366f1 },
};

const AVAILABLE_COLOR = 0x22c55e;

const STATUS_LABELS: Record<string, string> = {
  pending: "en attente",
  sent: "envoyée",
  success: "disponible",
  error: "en erreur",
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
function getSourceLink(mediaType: MediaType, externalId: string): { name: string; url: string } | null {
  switch (mediaType) {
    case "manga":
      return { name: "AniList", url: `https://anilist.co/manga/${externalId}` };
    case "comic":
      return { name: "ComicVine", url: `https://comicvine.gamespot.com/volume/4050-${externalId}/` };
    case "bd":
      return externalId.startsWith("ol-")
        ? { name: "Open Library", url: `https://openlibrary.org/works/${externalId.slice(3)}` }
        : { name: "Google Books", url: `https://books.google.com/books?id=${encodeURIComponent(externalId)}` };
    default:
      return null;
  }
}

function getAppLink(mediaType: MediaType, externalId: string): string | undefined {
  const appUrl = (process.env.NEXTAUTH_URL || process.env.AUTH_URL)?.replace(/\/$/, "");
  return appUrl ? `${appUrl}/details/${mediaType}/${encodeURIComponent(externalId)}` : undefined;
}

/** Ouvre la page de recherche Prowlarr pré-remplie avec le titre. */
function getProwlarrSearchLink(title: string): string | undefined {
  const prowlarrUrl = process.env.PROWLARR_URL?.replace(/\/$/, "");
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

async function postToDiscord(payload: unknown) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

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
}) {
  const { label: typeLabel, color } = TYPE_STYLES[mediaType] ?? TYPE_STYLES.bd;

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

  const links = [
    prowlarrLink && `[🔎 Chercher sur Prowlarr](${prowlarrLink})`,
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
        title: `Nouvelle demande : ${title}`.slice(0, 256),
        url: sourceLink?.url ?? appLink,
        description: `Une nouvelle demande a été ajoutée à la liste de souhaits.`,
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
  const { label: typeLabel } = TYPE_STYLES[mediaType] ?? TYPE_STYLES.bd;
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
