import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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

    const searchStr = seriesName.toLowerCase();
    
    // On vérifie si la demande contient le nom venant de Komga ou inversement
    const matchedRequest = pendingRequests.find(req => {
      const reqTitle = req.title.toLowerCase();
      return reqTitle.includes(searchStr) || searchStr.includes(reqTitle);
    });

    if (matchedRequest) {
      // 4. Mise à jour du statut
      await prisma.request.update({
        where: { id: matchedRequest.id },
        data: { status: "success" }
      });
      
      // 5. Envoi de l'email de notification
      if (matchedRequest.user?.email) {
        await sendEmail({
          to: matchedRequest.user.email,
          subject: `Votre demande est disponible !`,
          text: `Bonjour,\n\nVotre demande pour "${matchedRequest.title}" est maintenant disponible sur votre librairie.\n\nBonne lecture !\n\nL'équipe ReadSeerr`,
          html: `<p>Bonjour,</p><p>Votre demande pour <strong>"${matchedRequest.title}"</strong> est maintenant disponible sur votre librairie.</p><p>Bonne lecture !</p><p>L'équipe ReadSeerr</p>`,
        });
      }

      console.log(`Demande mise à jour avec succès : "${matchedRequest.title}"`);
      return NextResponse.json({ success: true, message: "Demande mise à jour avec succès." });
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
