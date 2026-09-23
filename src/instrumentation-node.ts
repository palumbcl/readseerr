import { getConfig } from "@/lib/config";
import { isKomgaConfigured } from "@/lib/komga";
import { syncLibrary } from "@/lib/media";
import { warmDiscoverCache } from "@/lib/discover";
import { checkFollowedReleases } from "@/lib/follows";

const RELEASE_CHECK_HOURS = 12;

export function getSyncIntervalMinutes(): number {
  return Math.max(5, parseInt(getConfig("komgaSyncIntervalMinutes") || "30", 10) || 30);
}

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

  // Komga : intervalle relu à chaque passage (modifiable dans /admin, pris en compte sans redémarrage).
  // Sans Komga configuré, chaque passage est ignoré : la connexion peut être ajoutée plus tard.
  const scheduleSync = (delayMs: number) => {
    setTimeout(async () => {
      if (isKomgaConfigured()) await syncLibrary();
      scheduleSync(getSyncIntervalMinutes() * 60_000);
    }, delayMs);
  };
  scheduleSync(15_000);

  console.log(`Synchronisation Komga planifiée toutes les ${getSyncIntervalMinutes()} min.`);
}
