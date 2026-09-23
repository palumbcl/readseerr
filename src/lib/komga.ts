import { getConfig } from "@/lib/config";

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
  const KOMGA_API_KEY = getConfig("komgaApiKey");
  const KOMGA_USER = getConfig("komgaUser");
  const KOMGA_PASSWORD = getConfig("komgaPassword");

  if (KOMGA_API_KEY) return { "X-API-Key": KOMGA_API_KEY };
  if (KOMGA_USER && KOMGA_PASSWORD) {
    return { Authorization: `Basic ${Buffer.from(`${KOMGA_USER}:${KOMGA_PASSWORD}`).toString("base64")}` };
  }
  return null;
}

function getKomgaBaseUrl(): string | null {
  return getConfig("komgaUrl")?.replace(/\/$/, "") || null;
}

/** URL de la série dans l'interface Komga (publique si Komga est joint via le réseau interne). */
export function getKomgaSeriesUrl(seriesId: string): string | null {
  const baseUrl = getKomgaBaseUrl();
  if (!baseUrl) return null;
  return `${(getConfig("komgaPublicUrl") || baseUrl).replace(/\/$/, "")}/series/${seriesId}`;
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

export interface KomgaRecentSeries {
  id: string;
  name: string;
  booksCount: number;
  url: string | null;
  /** Couverture servie par ReadSeerr (Komga exige une authentification) */
  thumbnailUrl: string;
  updatedAt: string | null;
}

/** Séries récemment ajoutées ou complétées dans la bibliothèque (page à partir de 1). */
export async function fetchLatestKomgaSeries(
  size = 20,
  page = 1
): Promise<{ items: KomgaRecentSeries[]; hasMore: boolean }> {
  const data = await komgaGet<KomgaPage<KomgaSeries & { lastModified?: string }>>(
    `/api/v1/series/latest?size=${size}&page=${page - 1}&deleted=false`,
    8000
  );
  const items = (data.content ?? []).map((s) => ({
    id: s.id,
    name: s.metadata?.title || s.name,
    booksCount: s.booksCount,
    url: getKomgaSeriesUrl(s.id),
    thumbnailUrl: `/api/library/thumbnail/${encodeURIComponent(s.id)}`,
    updatedAt: s.lastModified ?? null,
  }));
  return { items, hasMore: data.last === false };
}

/** Couverture d'une série Komga (image brute), null si indisponible. */
export async function fetchKomgaSeriesThumbnail(seriesId: string): Promise<Response | null> {
  const baseUrl = getKomgaBaseUrl();
  const headers = getKomgaAuthHeaders();
  if (!baseUrl || !headers) return null;

  const response = await fetch(`${baseUrl}/api/v1/series/${encodeURIComponent(seriesId)}/thumbnail`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  return response.ok ? response : null;
}

export function isKomgaLoginEnabled(): boolean {
  return getConfig("komgaLoginEnabled") === "true" && Boolean(getKomgaBaseUrl());
}

export interface KomgaAccount {
  id: string;
  email: string;
  roles: string[];
}

/**
 * Vérifie des identifiants Komga (email + mot de passe) auprès du serveur.
 * null = identifiants refusés ; "unavailable" = Komga injoignable.
 */
export async function authenticateKomgaUser(email: string, password: string): Promise<KomgaAccount | null | "unavailable"> {
  const baseUrl = getKomgaBaseUrl();
  if (!baseUrl) return "unavailable";

  try {
    const response = await fetch(`${baseUrl}/api/v2/users/me`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) return "unavailable";

    const account: KomgaAccount = await response.json();
    return account?.id && account.email ? { ...account, email: account.email.toLowerCase() } : null;
  } catch (error) {
    console.error("Connexion Komga impossible:", error);
    return "unavailable";
  }
}

/**
 * Cherche des séries portant ce titre dans la bibliothèque Komga.
 * Retourne null si Komga n'est pas configuré ou injoignable (la notification ne doit jamais en dépendre).
 */
export async function findKomgaSeries(title: string): Promise<KomgaSeriesMatch[] | null> {
  const baseUrl = getKomgaBaseUrl();
  const headers = getKomgaAuthHeaders();

  if (!baseUrl || !headers) return null;

  // Lien cliquable dans Discord : l'URL publique si Komga est joint via le réseau interne
  const publicUrl = (getConfig("komgaPublicUrl") || baseUrl).replace(/\/$/, "");

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
