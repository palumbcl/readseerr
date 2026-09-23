import { isKomgaConfigured } from "@/lib/komga";
import { syncLibrary } from "@/lib/media";

/**
 * Synchronisation périodique de la bibliothèque Komga (badges de disponibilité,
 * clôture des demandes dont le webhook aurait été manqué).
 */
export function startLibrarySyncSchedule() {
  if (!isKomgaConfigured()) return;

  const intervalMinutes = Math.max(5, parseInt(process.env.KOMGA_SYNC_INTERVAL_MINUTES || "30", 10) || 30);

  // Premier passage peu après le démarrage, pour ne pas ralentir la mise en route
  setTimeout(() => void syncLibrary(), 15_000);
  setInterval(() => void syncLibrary(), intervalMinutes * 60_000);

  console.log(`Synchronisation Komga planifiée toutes les ${intervalMinutes} min.`);
}
