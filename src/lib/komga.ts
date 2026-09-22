export interface KomgaSeriesMatch {
  name: string;
  booksCount: number;
  url: string;
}

interface KomgaSeries {
  id: string;
  name: string;
  booksCount: number;
  metadata?: { title?: string };
}

function getKomgaAuthHeaders(): Record<string, string> | null {
  const { KOMGA_API_KEY, KOMGA_USER, KOMGA_PASSWORD } = process.env;

  if (KOMGA_API_KEY) return { "X-API-Key": KOMGA_API_KEY };
  if (KOMGA_USER && KOMGA_PASSWORD) {
    return { Authorization: `Basic ${Buffer.from(`${KOMGA_USER}:${KOMGA_PASSWORD}`).toString("base64")}` };
  }
  return null;
}

/**
 * Cherche des séries portant ce titre dans la bibliothèque Komga.
 * Retourne null si Komga n'est pas configuré ou injoignable (la notification ne doit jamais en dépendre).
 */
export async function findKomgaSeries(title: string): Promise<KomgaSeriesMatch[] | null> {
  const baseUrl = process.env.KOMGA_URL?.replace(/\/$/, "");
  const headers = getKomgaAuthHeaders();

  if (!baseUrl || !headers) return null;

  // Lien cliquable dans Discord : l'URL publique si Komga est joint via le réseau interne
  const publicUrl = (process.env.KOMGA_PUBLIC_URL || baseUrl).replace(/\/$/, "");

  try {
    const params = new URLSearchParams({ search: title, size: "5" });
    const response = await fetch(`${baseUrl}/api/v1/series?${params}`, {
      headers: { ...headers, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Komga a répondu ${response.status} lors de la recherche de "${title}".`);
      return null;
    }

    const data: { content?: KomgaSeries[] } = await response.json();

    return (data.content ?? []).map((series) => ({
      name: series.metadata?.title || series.name,
      booksCount: series.booksCount,
      url: `${publicUrl}/series/${series.id}`,
    }));
  } catch (error) {
    console.error("Erreur lors de la recherche Komga:", error);
    return null;
  }
}
