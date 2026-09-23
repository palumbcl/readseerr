import { sendEmail } from "@/lib/email";

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
  user: { name: string; email: string | null };
  title: string;
  coverUrl?: string | null;
  reason?: string | null;
}): Promise<boolean> {
  if (!user.email) return false;

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

  return sendEmail({ to: user.email, subject: SUBJECTS[kind], text, html });
}
