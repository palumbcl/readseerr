import { isKomgaConfigured } from "@/lib/komga";
import { syncLibrary } from "@/lib/media";
import { warmDiscoverCache } from "@/lib/discover";
import { checkFollowedReleases } from "@/lib/follows";

const RELEASE_CHECK_HOURS = 12;

async function runReleaseCheck() {
  try {
    const releases = await checkFollowedReleases();
    if (releases > 0) console.log(`Suivi : ${releases} nouvelle(s) parution(s) détectée(s).`);
  } catch (error) {
    console.error("Vérification des parutions des séries suivies échouée:", error);
  }
}

/**
 * Tâches de fond : préchargement de la page Découvrir, parutions des séries suivies
 * et synchronisation périodique de la bibliothèque Komga (badges, clôture des demandes).
 */
export function startLibrarySyncSchedule() {
  // Page Découvrir : cache rafraîchi avant son expiration (1 h 05) pour rester toujours chaud
  setTimeout(() => void warmDiscoverCache(), 10_000);
  setInterval(() => void warmDiscoverCache(), 55 * 60_000);

  // Séries suivies : nouveaux numéros parus (ComicVine / AniList), deux fois par jour
  setTimeout(() => void runReleaseCheck(), 2 * 60_000);
  setInterval(() => void runReleaseCheck(), RELEASE_CHECK_HOURS * 3_600_000);

  if (!isKomgaConfigured()) return;

  const intervalMinutes = Math.max(5, parseInt(process.env.KOMGA_SYNC_INTERVAL_MINUTES || "30", 10) || 30);

  // Premier passage peu après le démarrage, pour ne pas ralentir la mise en route
  setTimeout(() => void syncLibrary(), 15_000);
  setInterval(() => void syncLibrary(), intervalMinutes * 60_000);

  console.log(`Synchronisation Komga planifiée toutes les ${intervalMinutes} min.`);
}
