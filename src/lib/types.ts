/* ===========================
   ReadSeerr — Shared Types
   =========================== */

export type MediaType = "manga" | "comic";

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
  /** Other known titles (romaji, English…), used to match the Komga library */
  altTitles?: string[];
  /** Library / request state, added by the API (never cached) */
  availability?: Availability | null;
}

/** Statut agrégé d'une œuvre, affiché en badge */
export type AvailabilityStatus = "available" | "partially_available" | "processing" | "pending";

export interface Availability {
  status: AvailabilityStatus;
  /** Nombre de tomes présents dans Komga */
  booksInLibrary?: number;
  librarySeriesUrl?: string | null;
}

export type RequestStatus = "pending" | "approved" | "declined" | "available";

/** État de l'œuvre pour la page détail : bibliothèque, demande de l'utilisateur, autres demandes */
export interface DetailAvailability {
  availability: Availability | null;
  library: {
    name: string;
    url: string | null;
    booksCount: number;
    /** Numéros des tomes présents, null si Komga est injoignable */
    volumes: number[] | null;
  } | null;
  myRequest: {
    id: string;
    status: RequestStatus;
    volumes: number[] | null;
    declineReason: string | null;
  } | null;
  /** Demandes en cours d'autres utilisateurs */
  otherRequests: number;
  /** Suivi de la série par l'utilisateur (null s'il ne la suit pas) */
  follow: { autoRequest: boolean } | null;
}

/** Série suivie, pour la page « Mes demandes » */
export interface FollowedSeries {
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl: string | null;
  status: string;
  libraryBooksCount: number | null;
  volumeCount: number | null;
  autoRequest: boolean;
  followedAt: string;
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
  altTitles?: string[];
  volumeCount?: number | null;
  year?: number | null;
  /** Métadonnées affichées dans la notification Discord (non stockées) */
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
  externalId: string;
  title: string;
  coverUrl: string | null;
  volumes: string | null;
  status: RequestStatus;
  declineReason: string | null;
  createdAt: string;
  handledAt: string | null;
}

/** Demande vue par l'administrateur */
export interface AdminRequestRecord extends RequestRecord {
  user: { id: string; name: string; email: string };
  handledBy: { name: string } | null;
  library: { name: string; url: string | null; booksCount: number } | null;
  /** Demandes en cours d'autres utilisateurs sur la même œuvre */
  otherRequests: number;
  sourceUrl: string | null;
  prowlarrUrl: string | null;
}

/** Série récemment ajoutée dans Komga (page Découvrir) */
export interface LibraryRecentItem {
  id: string;
  name: string;
  booksCount: number;
  url: string | null;
  thumbnailUrl: string;
  updatedAt: string | null;
}

export interface DiscoverRow {
  id: "trending-manga" | "new-manga" | "recent-comics" | "recent-requests";
  title: string;
  subtitle: string;
  items: MediaResult[];
}

/** GET /api/discover */
export interface DiscoverResponse {
  /** null si Komga n'est pas configuré ou injoignable */
  library: LibraryRecentItem[] | null;
  rows: DiscoverRow[];
}

export type IssueType = "missing_volume" | "bad_file" | "wrong_content" | "metadata" | "other";
export type IssueStatus = "open" | "resolved";

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  missing_volume: "Tome manquant",
  bad_file: "Fichier illisible ou corrompu",
  wrong_content: "Mauvais contenu (langue, édition…)",
  metadata: "Titre, couverture ou numérotation erronés",
  other: "Autre",
};

/** Signalement, tel qu'affiché dans les listes */
export interface IssueRecord {
  id: string;
  type: IssueType;
  volume: number | null;
  message: string;
  status: IssueStatus;
  createdAt: string;
  resolvedAt: string | null;
  media: { mediaType: MediaType; externalId: string; title: string; coverUrl: string | null };
  user: { name: string };
  resolvedBy: { name: string } | null;
  commentCount: number;
}

export interface IssueComment {
  id: string;
  message: string;
  createdAt: string;
  user: { name: string; isAdmin: boolean };
}

/** Signalement complet (page de discussion) */
export interface IssueDetail extends IssueRecord {
  comments: IssueComment[];
  libraryUrl: string | null;
  /** L'utilisateur courant peut résoudre / rouvrir (auteur ou admin) */
  canManage: boolean;
}
