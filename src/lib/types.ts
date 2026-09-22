/* ===========================
   ReadSeerr — Shared Types
   =========================== */

export type MediaType = "manga" | "comic" | "bd";

/** Unified search result returned by /api/search */
export interface MediaResult {
  id: string;
  title: string;
  year: number | null;
  coverUrl: string | null;
  type: MediaType;
  publisher: string | null;
  author: string | null;
  /** Number of volumes (manga) or issues (comics), when known */
  volumeCount?: number | null;
}

/** One page of results from a source, as returned by /api/search */
export interface SearchPage {
  results: MediaResult[];
  hasMore: boolean;
  /** Total number of pages, when the source reports it (lets the client fetch pages in parallel) */
  totalPages?: number;
  /** Total number of matches reported by the source, before any local filtering */
  total?: number;
}

/** Full details returned by /api/details */
export interface MediaDetail extends MediaResult {
  description: string | null;
  status: string | null;
  volumes: VolumeInfo[];
  chapters: number | null;
  genres: string[];
  startDate: string | null;
  endDate: string | null;
  bannerUrl: string | null;
}

/** Volume/Issue info for the volume selector */
export interface VolumeInfo {
  number: number;
  title: string | null;
  issueId: string | null;
}

/** POST /api/request body */
export interface RequestPayload {
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl?: string;
  volumes?: number[];
  /** Métadonnées affichées dans la notification Discord (non stockées) */
  year?: number | null;
  publisher?: string | null;
  author?: string | null;
}

/** POST /api/request response */
export interface RequestResponse {
  success: boolean;
  message: string;
  requestId?: string;
}

/** Request record from DB (for history) */
export interface RequestRecord {
  id: string;
  mediaType: MediaType;
  title: string;
  coverUrl: string | null;
  volumes: string | null;
  status: string;
  targetService: "manual" | string;
  errorMessage: string | null;
  createdAt: string;
  userName?: string;
}
