import { NextRequest, NextResponse } from "next/server";
import { isKomgaConfigured } from "@/lib/komga";
import { fulfillByTitles, syncLibrary } from "@/lib/media";
import { stripVolumeNumber } from "@/lib/titles";
import { getConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    // 1. Sécurité : Vérification du token
    const authHeader = request.headers.get("authorization");
    const urlToken = request.nextUrl.searchParams.get("token");
    const expectedToken = getConfig("komgaWebhookSecret");

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

    // 2. Avec l'API Komga : resynchronisation complète. Elle vérifie tome par tome que chaque
    // demande est satisfaite. Les rafales de webhooks (import de nombreux tomes) sont fusionnées.
    if (isKomgaConfigured()) {
      void syncLibrary();
      return NextResponse.json({ success: true, message: "Synchronisation de la bibliothèque lancée." });
    }

    // 3. Sans API : correspondance exacte sur les titres présents dans le payload
    const body = await request.json();
    const seriesName = body.series?.name || body.series?.title || body.book?.seriesTitle || body.book?.name || body.name;

    // Toutes les formes connues du titre de la série (titre des métadonnées, nom du dossier, etc.)
    const candidateTitles = [
      body.series?.metadata?.title,
      body.series?.name,
      body.series?.title,
      body.book?.seriesTitle,
      body.name,
      typeof body.book?.name === "string" ? stripVolumeNumber(body.book.name) : undefined,
    ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

    if (!seriesName) {
      console.log("Webhook Komga: Aucun titre trouvé dans le payload.", body);
      // On renvoie un succès silencieux pour ne pas alerter inutilement Komga
      return NextResponse.json({ success: true, message: "Événement ignoré (aucun titre trouvé)." });
    }

    console.log(`Webhook Komga reçu pour le titre : "${seriesName}"`);
    const count = await fulfillByTitles(candidateTitles, seriesName);

    return NextResponse.json({
      success: true,
      message: count > 0 ? `${count} demande(s) mise(s) à jour avec succès.` : "Aucune demande correspondante en attente.",
    });
  } catch (error) {
    console.error("Erreur lors du traitement du webhook Komga:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
