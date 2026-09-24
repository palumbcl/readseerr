import { sendEmail } from "@/lib/email";
import { pushUser } from "@/lib/push";

/** Destinataire : email et, s'il en a défini un, sujet ntfy pour les notifications push. */
type Recipient = { name: string; email: string | null; ntfyTopic?: string | null };

/**
 * Envoie la même information par email et en notification push.
 * Renvoie true si l'email est parti (compteur « prévenus par email » des notifications admin).
 */
async function deliver(
  user: Recipient,
  mail: { subject: string; text: string; html: string },
  push: { message: string; click?: string | null; tags?: string[] }
): Promise<boolean> {
  const [emailed] = await Promise.all([
    user.email ? sendEmail({ to: user.email, ...mail }) : Promise.resolve(false),
    pushUser(user.ntfyTopic, { title: mail.subject, ...push }),
  ]);
  return emailed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRequestsLink(): string | null {
  const appUrl = (process.env.NEXTAUTH_URL || process.env.AUTH_URL)?.replace(/\/$/, "");
  return appUrl ? `${appUrl}/requests` : null;
}

type StatusEmailKind = "available" | "approved" | "declined";

const SUBJECTS: Record<StatusEmailKind, string> = {
  available: "Votre demande est disponible !",
  approved: "Votre demande a été acceptée",
  declined: "Votre demande a été refusée",
};

/** Prévient un utilisateur de l'évolution de sa demande. Renvoie true si l'email est parti. */
export async function sendRequestStatusEmail({
  kind,
  user,
  title,
  coverUrl,
  reason,
}: {
  kind: StatusEmailKind;
  user: Recipient;
  title: string;
  coverUrl?: string | null;
  reason?: string | null;
}): Promise<boolean> {

  const body: Record<StatusEmailKind, string> = {
    available: `Votre demande pour "${title}" est maintenant disponible sur votre librairie.\n\nBonne lecture !`,
    approved: `Votre demande pour "${title}" a été acceptée : elle sera ajoutée à la librairie prochainement. Vous recevrez un email dès qu'elle sera disponible.`,
    declined: `Votre demande pour "${title}" a été refusée.${reason ? `\n\nMotif : ${reason}` : ""}`,
  };
  const link = getRequestsLink();
  const text = `Bonjour ${user.name},\n\n${body[kind]}\n\n${link ? `Suivre vos demandes : ${link}\n\n` : ""}L'équipe ReadSeerr`;

  const html = [
    coverUrl ? `<p><img src="${escapeHtml(coverUrl)}" alt="" width="160" style="border-radius:8px" /></p>` : "",
    `<p>Bonjour ${escapeHtml(user.name)},</p>`,
    ...body[kind].split("\n\n").map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    link ? `<p><a href="${escapeHtml(link)}">Suivre vos demandes</a></p>` : "",
    "<p>L'équipe ReadSeerr</p>",
  ].join("");

  const tags = { available: ["white_check_mark"], approved: ["thumbsup"], declined: ["x"] }[kind];
  return deliver(
    user,
    { subject: SUBJECTS[kind], text, html },
    { message: body[kind].replace(/\n\n/g, "\n"), click: link, tags }
  );
}

/**
 * Nouveautés d'une série suivie : tomes arrivés dans la bibliothèque, ou numéros parus
 * (avec, le cas échéant, la demande créée automatiquement).
 */
export async function sendFollowUpdateEmail({
  kind,
  user,
  title,
  coverUrl,
  count,
  libraryUrl,
  autoRequested = false,
}: {
  kind: "library" | "release";
  user: Recipient;
  title: string;
  coverUrl?: string | null;
  count: number;
  libraryUrl?: string | null;
  autoRequested?: boolean;
}): Promise<boolean> {

  const plural = count > 1;
  const subject =
    kind === "library"
      ? `${title} : ${count} nouveau${plural ? "x" : ""} tome${plural ? "s" : ""} disponible${plural ? "s" : ""}`
      : `${title} : ${count} nouveau${plural ? "x" : ""} numéro${plural ? "s" : ""} paru${plural ? "s" : ""}`;

  const paragraphs =
    kind === "library"
      ? [
          `${count} nouveau${plural ? "x" : ""} tome${plural ? "s" : ""} de "${title}", une série que vous suivez, ${plural ? "sont" : "est"} arrivé${plural ? "s" : ""} dans la librairie.`,
          "Bonne lecture !",
        ]
      : [
          `${count} nouveau${plural ? "x" : ""} numéro${plural ? "s" : ""} de "${title}", une série que vous suivez, ${plural ? "sont" : "est"} paru${plural ? "s" : ""}.`,
          autoRequested
            ? "Une demande a été créée automatiquement : vous serez prévenu dès que ces numéros seront disponibles."
            : "Vous pouvez les demander depuis la fiche de la série.",
        ];

  const link = kind === "library" && libraryUrl ? libraryUrl : getRequestsLink();
  const linkLabel = kind === "library" && libraryUrl ? "Lire dans Komga" : "Suivre vos demandes";
  const text = `Bonjour ${user.name},\n\n${paragraphs.join("\n\n")}\n\n${link ? `${linkLabel} : ${link}\n\n` : ""}L'équipe ReadSeerr`;
  const html = [
    coverUrl ? `<p><img src="${escapeHtml(coverUrl)}" alt="" width="160" style="border-radius:8px" /></p>` : "",
    `<p>Bonjour ${escapeHtml(user.name)},</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    link ? `<p><a href="${escapeHtml(link)}">${linkLabel}</a></p>` : "",
    "<p>L'équipe ReadSeerr</p>",
  ].join("");

  return deliver(
    user,
    { subject, text, html },
    { message: paragraphs.join("\n"), click: link, tags: [kind === "library" ? "books" : "new"] }
  );
}

/** Prévient l'auteur d'un signalement : réponse de l'admin, résolution ou réouverture. */
export async function sendIssueUpdateEmail({
  kind,
  user,
  title,
  issueId,
  message,
}: {
  kind: "comment" | "resolved" | "reopened";
  user: Recipient;
  title: string;
  issueId: string;
  message?: string | null;
}): Promise<boolean> {

  const subjects = {
    comment: `Réponse à votre signalement : ${title}`,
    resolved: `Signalement résolu : ${title}`,
    reopened: `Signalement rouvert : ${title}`,
  };
  const intro = {
    comment: `L'administrateur a répondu à votre signalement sur "${title}".`,
    resolved: `Le problème que vous avez signalé sur "${title}" a été résolu.`,
    reopened: `Votre signalement sur "${title}" a été rouvert.`,
  };
  const paragraphs = [intro[kind], ...(message ? [`« ${message} »`] : [])];

  const appUrl = (process.env.NEXTAUTH_URL || process.env.AUTH_URL)?.replace(/\/$/, "");
  const link = appUrl ? `${appUrl}/issues/${issueId}` : null;
  const text = `Bonjour ${user.name},\n\n${paragraphs.join("\n\n")}\n\n${link ? `Voir la discussion : ${link}\n\n` : ""}L'équipe ReadSeerr`;
  const html = [
    `<p>Bonjour ${escapeHtml(user.name)},</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    link ? `<p><a href="${escapeHtml(link)}">Voir la discussion</a></p>` : "",
    "<p>L'équipe ReadSeerr</p>",
  ].join("");

  return deliver(
    user,
    { subject: subjects[kind], text, html },
    { message: paragraphs.join("\n"), click: link, tags: [kind === "resolved" ? "white_check_mark" : "speech_balloon"] }
  );
}
