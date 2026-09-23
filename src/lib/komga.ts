export interface KomgaSeriesMatch {
  name: string;
  booksCount: number;
  url: string;
}

interface KomgaSeries {
  id: string;
  name: string;
  booksCount: number;
  metadata?: { title?: string; alternateTitles?: { label?: string; title?: string }[] };
}

interface KomgaPage<T> {
  content?: T[];
  last?: boolean;
  totalPages?: number;
}

interface KomgaBook {
  number?: number;
  metadata?: { numberSort?: number; number?: string };
}

function getKomgaAuthHeaders(): Record<string, string> | null {
  const { KOMGA_API_KEY, KOMGA_USER, KOMGA_PASSWORD } = process.env;

  if (KOMGA_API_KEY) return { "X-API-Key": KOMGA_API_KEY };
  if (KOMGA_USER && KOMGA_PASSWORD) {
    return { Authorization: `Basic ${Buffer.from(`${KOMGA_USER}:${KOMGA_PASSWORD}`).toString("base64")}` };
  }
  return null;
}

function getKomgaBaseUrl(): string | null {
  return process.env.KOMGA_URL?.replace(/\/$/, "") || null;
}

/** URL de la série dans l'interface Komga (publique si Komga est joint via le réseau interne). */
export function getKomgaSeriesUrl(seriesId: string): string | null {
  const baseUrl = getKomgaBaseUrl();
  if (!baseUrl) return null;
  return `${(process.env.KOMGA_PUBLIC_URL || baseUrl).replace(/\/$/, "")}/series/${seriesId}`;
}

export function isKomgaConfigured(): boolean {
  return Boolean(getKomgaBaseUrl() && getKomgaAuthHeaders());
}

async function komgaGet<T>(path: string, timeoutMs = 15000): Promise<T> {
  const baseUrl = getKomgaBaseUrl();
  const headers = getKomgaAuthHeaders();
  if (!baseUrl || !headers) throw new Error("Komga n'est pas configuré.");

  const response = await fetch(`${baseUrl}${path}`, {
    headers: { ...headers, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Komga a répondu ${response.status} (${path}).`);
  return response.json();
}

export interface KomgaLibrarySeries {
  id: string;
  name: string;
  /** Titre des métadonnées, nom du dossier et titres alternatifs */
  titles: string[];
  booksCount: number;
}

/** Toutes les séries de la bibliothèque, page par page. */
export async function fetchAllKomgaSeries(): Promise<KomgaLibrarySeries[]> {
  const series: KomgaLibrarySeries[] = [];

  for (let page = 0; ; page++) {
    const data = await komgaGet<KomgaPage<KomgaSeries>>(`/api/v1/series?page=${page}&size=500&deleted=false`);
    for (const s of data.content ?? []) {
      series.push({
        id: s.id,
        name: s.metadata?.title || s.name,
        titles: [s.metadata?.title, s.name, ...(s.metadata?.alternateTitles ?? []).map((t) => t.title)].filter(
          (t): t is string => typeof t === "string" && t.trim() !== ""
        ),
        booksCount: s.booksCount,
      });
    }
    if (data.last !== false || (data.content ?? []).length === 0) break;
  }

  return series;
}

/** Numéros des tomes présents dans une série Komga (null si Komga est injoignable). */
export async function fetchKomgaBookNumbers(seriesId: string): Promise<number[] | null> {
  try {
    const data = await komgaGet<KomgaPage<KomgaBook>>(
      `/api/v1/series/${encodeURIComponent(seriesId)}/books?unpaged=true`,
      5000
    );
    const numbers = (data.content ?? [])
      .map((book) => book.metadata?.numberSort ?? book.number)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return [...new Set(numbers)].sort((a, b) => a - b);
  } catch (error) {
    console.error(`Impossible de lire les tomes de la série Komga ${seriesId}:`, error);
    return null;
  }
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
