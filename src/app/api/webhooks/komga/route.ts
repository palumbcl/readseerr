import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendDiscordAvailableNotification } from "@/lib/discord";
import type { MediaType } from "@/lib/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Forme canonique d'un titre pour la comparaison :
 * "L'Arabe du futur (2014) [Intégrale]" -> "arabe du futur", "Billy Bat" -> "billy bat".
 */
function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // "(2014)", "[Intégrale]"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|le|la|les|l) /, "")
    .replace(/\s+/g, " ");
}

/** "Billy Bat - Tome 03" / "Billy Bat #3" / "Billy Bat T03" -> "Billy Bat" */
function stripVolumeNumber(bookName: string): string {
  return bookName.replace(/[\s,._-]*(?:tome|vol(?:ume)?\.?|t|#|n°)?\s*\d+\s*$/i, "");
}

export async function POST(request: NextRequest) {
  try {
    // 1. Sécurité : Vérification du token
    const authHeader = request.headers.get("authorization");
    const urlToken = request.nextUrl.searchParams.get("token");
    const expectedToken = process.env.KOMGA_WEBHOOK_SECRET;

    if (!expectedToken) {
      console.error("KOMGA_WEBHOOK_SECRET n'est pas défini dans les variables d'environnement.");
      return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
    }

    // Accepte le token depuis l'en-tête Authorization (ex: "Bearer MON_SECRET" ou juste "MON_SECRET")
    // ou depuis l'URL (?token=MON_SECRET)
    const providedToken = urlToken || (authHeader ? authHeader.replace("Bearer ", "") : null);

    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 2. Extraction du payload Komga
    const body = await request.json();
    
    // Les événements BookAdded ou SeriesAdded envoient souvent un objet "series" ou "book"
    const seriesName = body.series?.name || body.series?.title || body.book?.seriesTitle || body.book?.name || body.name;

    // Toutes les formes connues du titre de la série (titre des métadonnées, nom du dossier, etc.)
    const candidateTitles = new Set(
      [
        body.series?.metadata?.title,
        body.series?.name,
        body.series?.title,
        body.book?.seriesTitle,
        body.name,
        typeof body.book?.name === "string" ? stripVolumeNumber(body.book.name) : undefined,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .map(normalizeTitle)
        .filter(Boolean)
    );

    if (!seriesName) {
      console.log("Webhook Komga: Aucun titre trouvé dans le payload.", body);
      // On renvoie un succès silencieux pour ne pas alerter inutilement Komga
      return NextResponse.json({ success: true, message: "Événement ignoré (aucun titre trouvé)." });
    }

    console.log(`Webhook Komga reçu pour le titre : "${seriesName}"`);

    // 3. Recherche dans la base de données
    // Récupérer toutes les demandes "pending" (en attente)
    // Comme SQLite gère difficilement l'insensibilité à la casse directement avec Prisma, 
    // on filtre la correspondance côté JavaScript (sécurisé car il y a peu de demandes en "pending").
    const pendingRequests = await prisma.request.findMany({
      where: {
        status: "pending",
      },
      include: {
        user: true,
      }
    });

    // Correspondance stricte sur le titre normalisé : "Batman" ne valide plus "Batman: Year One".
    // Plusieurs utilisateurs peuvent avoir demandé la même série : on les traite toutes.
    const matchedRequests = pendingRequests.filter(req => candidateTitles.has(normalizeTitle(req.title)));

    if (matchedRequests.length > 0) {
      // 4. Mise à jour du statut
      await prisma.request.updateMany({
        where: { id: { in: matchedRequests.map(req => req.id) } },
        data: { status: "success" }
      });

      // 5. Regroupement par œuvre : un seul email par utilisateur et une seule notif Discord par œuvre
      const byWork = new Map<string, typeof matchedRequests>();
      for (const req of matchedRequests) {
        const key = `${req.mediaType}:${req.externalId}`;
        byWork.set(key, [...(byWork.get(key) ?? []), req]);
      }

      for (const requests of byWork.values()) {
        const [first] = requests;
        const users = [...new Map(requests.map(req => [req.userId, req.user])).values()];
        const safeTitle = escapeHtml(first.title);

        const emailResults = await Promise.all(
          users.map(user =>
            user.email
              ? sendEmail({
                  to: user.email,
                  subject: `Votre demande est disponible !`,
                  text: `Bonjour ${user.name},

Votre demande pour "${first.title}" est maintenant disponible sur votre librairie.

Bonne lecture !

L'équipe ReadSeerr`,
                  html: `${first.coverUrl ? `<p><img src="${escapeHtml(first.coverUrl)}" alt="" width="160" style="border-radius:8px" /></p>` : ""}<p>Bonjour ${escapeHtml(user.name)},</p><p>Votre demande pour <strong>"${safeTitle}"</strong> est maintenant disponible sur votre librairie.</p><p>Bonne lecture !</p><p>L'équipe ReadSeerr</p>`,
                })
              : Promise.resolve(false)
          )
        );

        await sendDiscordAvailableNotification({
          title: first.title,
          mediaType: first.mediaType as MediaType,
          coverUrl: first.coverUrl,
          komgaSeriesName: seriesName,
          userNames: users.map(user => user.name || user.email),
          emailedCount: emailResults.filter(Boolean).length,
        });

        console.log(`Demande(s) mise(s) à jour avec succès : "${first.title}" (${requests.length})`);
      }

      return NextResponse.json({
        success: true,
        message: `${matchedRequests.length} demande(s) mise(s) à jour avec succès.`,
      });
    }

    return NextResponse.json({ success: true, message: "Aucune demande correspondante en attente." });

  } catch (error) {
    console.error("Erreur lors du traitement du webhook Komga:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
