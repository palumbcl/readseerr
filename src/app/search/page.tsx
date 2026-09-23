"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback, useRef, useMemo } from "react";
import SearchBar from "@/components/SearchBar";
import MediaGrid from "@/components/MediaGrid";
import { normalizeTitle, seriesKey } from "@/lib/titles";
import type { MediaResult, MediaType, SearchPage } from "@/lib/types";

const MEDIA_TYPES = ["manga", "comic"] as const;

const FILTER_OPTIONS: { value: MediaType | "all"; label: string; emoji: string }[] = [
  { value: "all", label: "Tous", emoji: "📚" },
  { value: "manga", label: "Manga", emoji: "🇯🇵" },
  { value: "comic", label: "Comics & BD", emoji: "📘" },
];

const TYPE_LABELS: Record<MediaType, string> = {
  manga: "manga",
  comic: "comics & BD",
};

// Sorting is purely client-side, applied once every result has been loaded
type SortOrder = "relevance" | "popularity" | "volumes" | "newest" | "oldest" | "title";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "relevance", label: "Pertinence" },
  { value: "popularity", label: "Popularité" },
  { value: "volumes", label: "Nombre de tomes" },
  { value: "newest", label: "Plus récent → plus ancien" },
  { value: "oldest", label: "Plus ancien → plus récent" },
  { value: "title", label: "Titre (A → Z)" },
];

type LibraryFilter = "all" | "available" | "missing";

const LIBRARY_OPTIONS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "available", label: "Disponible dans la bibliothèque" },
  { value: "missing", label: "Pas encore disponible" },
];

const isInLibrary = (r: MediaResult) =>
  r.availability?.status === "available" || r.availability?.status === "partially_available";

/** Mots vides ignorés pour juger si un titre correspond à la recherche */
const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "le", "la", "les", "l", "un", "une", "de", "des", "du", "d", "et"]);

function queryTokens(query: string): string[] {
  return normalizeTitle(query)
    .split(" ")
    .filter((t) => t && !STOP_WORDS.has(t));
}

/** Le titre (ou un titre alternatif, ou l'auteur) contient-il tous les mots de la recherche ? */
function matchesQuery(r: MediaResult, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return [r.title, ...(r.altTitles ?? []), r.author ?? ""].some((title) => {
    const words = normalizeTitle(title).split(" ");
    return tokens.every((token) => words.some((word) => word.startsWith(token)));
  });
}

/**
 * Échelle commune mangas / comics : AniList compte environ 100 fois plus de membres que les listes
 * de lecture d'Open Library. Approximation, mais bien plus parlante qu'un simple entrelacement.
 */
const OPEN_LIBRARY_WEIGHT = 100;

/**
 * Popularité : membres AniList pour les mangas ; lecteurs Open Library (listes de lecture + notes,
 * regroupés par série) pour les comics, que ComicVine ne classe pas.
 * La pertinence reste prioritaire : les titres contenant tous les mots de la recherche passent
 * d'abord, puis les autres ("civil war" : les Civil War de Marvel avant "The Forever War").
 * Les œuvres sans donnée suivent dans l'ordre de pertinence. Open Library ne distinguant pas les
 * éditions d'un même titre, à score égal la série la plus longue (la série historique) passe devant.
 */
function sortByPopularity(list: MediaResult[], comicScores: Record<string, number>, query: string): MediaResult[] {
  const score = (r: MediaResult) =>
    r.type === "manga" ? r.popularity ?? 0 : (comicScores[seriesKey(r.title)] ?? 0) * OPEN_LIBRARY_WEIGHT;

  const rankGroup = (group: MediaResult[]) => [
    ...group
      .filter((r) => score(r) > 0)
      .sort((a, b) => score(b) - score(a) || (b.volumeCount ?? 0) - (a.volumeCount ?? 0)),
    ...group.filter((r) => score(r) <= 0),
  ];

  const tokens = queryTokens(query);
  return [
    ...rankGroup(list.filter((r) => matchesQuery(r, tokens))),
    ...rankGroup(list.filter((r) => !matchesQuery(r, tokens))),
  ];
}

/**
 * Every page of every source is loaded up front so sorting and filtering see the
 * whole result set. Caps keep a very broad query from draining API quotas
 * (ComicVine: ~200 requests/hour, 100 results/page).
 */
const MAX_PAGES: Record<MediaType, number> = {
  manga: 40, // 50/page → 2 000 series
  comic: 40, // 100/page → 4 000 series
};
const PARALLEL_PAGES = 3;

/** Cards rendered at once; more are revealed while scrolling (keeps the DOM light) */
const DISPLAY_STEP = 120;

interface SourceState {
  loadedPages: number;
  /** Pages expected in total (capped), null while unknown */
  totalPages: number | null;
  /** Matches reported by the source, when known */
  total: number | null;
  done: boolean;
  /** Stopped at MAX_PAGES while the source still had results */
  capped: boolean;
  failed: boolean;
}

type SourcesState = Record<MediaType, SourceState>;

const initialSource = (): SourceState => ({
  loadedPages: 0,
  totalPages: null,
  total: null,
  done: false,
  capped: false,
  failed: false,
});

const initialSources = (): SourcesState => ({
  manga: initialSource(),
  comic: initialSource(),
});

const resultKey = (r: MediaResult) => `${r.type}-${r.id}`;

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<MediaResult[]>([]);
  const [sources, setSources] = useState<SourcesState>(initialSources);
  const [activeFilters, setActiveFilters] = useState<Set<MediaType | "all">>(new Set(["all"]));
  const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");
  const [authorFilter, setAuthorFilter] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  // Popularité des comics (Open Library), chargée en parallèle des résultats
  const [comicScores, setComicScores] = useState<Record<string, number>>({});
  // Auteurs dont le nom correspond à la recherche : leurs œuvres passent en tête
  const [matchedAuthors, setMatchedAuthors] = useState<string[]>([]);
  const [displayCount, setDisplayCount] = useState(DISPLAY_STEP);

  // Pages arrive out of order (parallel fetches): keep them keyed by source/page and
  // rebuild the list in page order so the relevance ranking is preserved
  const chunksRef = useRef(new Map<string, { type: MediaType; page: number; items: MediaResult[] }>());
  const sourcesRef = useRef<SourcesState>(sources);
  const generationRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const updateSource = useCallback((type: MediaType, patch: Partial<SourceState>) => {
    sourcesRef.current = {
      ...sourcesRef.current,
      [type]: { ...sourcesRef.current[type], ...patch },
    };
    setSources(sourcesRef.current);
  }, []);

  const rebuildResults = useCallback(() => {
    const chunks = [...chunksRef.current.values()].sort(
      (a, b) => a.page - b.page || MEDIA_TYPES.indexOf(a.type) - MEDIA_TYPES.indexOf(b.type)
    );
    const seen = new Set<string>();
    const list: MediaResult[] = [];
    for (const chunk of chunks) {
      for (const r of chunk.items) {
        const key = resultKey(r);
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(r);
      }
    }
    setResults(list);
  }, []);

  /** Loads every page of one source: page 1 first, then the rest PARALLEL_PAGES at a time */
  const loadSource = useCallback(
    async (type: MediaType, generation: number, signal: AbortSignal) => {
      const isCurrent = () => generation === generationRef.current;
      const maxPages = MAX_PAGES[type];

      const fetchPage = async (page: number): Promise<SearchPage> => {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}`,
          { signal }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: SearchPage = await response.json();
        if (isCurrent()) {
          chunksRef.current.set(`${type}:${page}`, { type, page, items: data.results });
          updateSource(type, { loadedPages: sourcesRef.current[type].loadedPages + 1 });
          rebuildResults();
        }
        return data;
      };

      try {
        const first = await fetchPage(1);
        if (!isCurrent()) return;

        const knownPages = first.totalPages ? Math.min(first.totalPages, maxPages) : null;
        updateSource(type, { totalPages: knownPages, total: first.total ?? null });

        let hasMore = first.hasMore;
        let next = 2;
        while (hasMore && next <= maxPages && isCurrent()) {
          // Page count known → fetch a batch in parallel; unknown → one page at a time
          const last = knownPages && knownPages >= next
            ? Math.min(knownPages, next + PARALLEL_PAGES - 1)
            : next;
          const pages = Array.from({ length: last - next + 1 }, (_, i) => next + i);
          const batch = await Promise.all(pages.map(fetchPage));
          hasMore = batch[batch.length - 1].hasMore;
          next = last + 1;
        }

        if (isCurrent()) {
          updateSource(type, { done: true, capped: hasMore && next > maxPages });
        }
      } catch (err) {
        if (!isCurrent()) return; // superseded by a new search
        console.error(`Search error [${type}]:`, err);
        // Keep what was loaded, just stop this source
        updateSource(type, { done: true, failed: true });
      }
    },
    [query, updateSource, rebuildResults]
  );

  // New query: reset everything and load all sources in parallel
  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();

    chunksRef.current.clear();
    sourcesRef.current = initialSources();
    setSources(sourcesRef.current);
    setResults([]);
    setActiveFilters(new Set(["all"]));
    setSortOrder("relevance");
    setAuthorFilter("");
    setLibraryFilter("all");
    setDisplayCount(DISPLAY_STEP);

    setComicScores({});
    setMatchedAuthors([]);
    if (query.length >= 2) {
      MEDIA_TYPES.forEach((type) => loadSource(type, generation, controller.signal));

      // Recherche par auteur, en parallèle : ses œuvres forment un bloc placé avant la page 1
      MEDIA_TYPES.forEach((type) => {
        fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}&author=1`, { signal: controller.signal })
          .then((response) => (response.ok ? response.json() : null))
          .then((data: SearchPage | null) => {
            if (!data || generation !== generationRef.current || data.results.length === 0) return;
            chunksRef.current.set(`${type}:author`, { type, page: 0, items: data.results });
            setMatchedAuthors((prev) => [...new Set([...prev, ...(data.authors ?? [])])]);
            rebuildResults();
          })
          .catch(() => undefined);
      });
      fetch(`/api/popularity?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { scores: {} }))
        .then((data) => generation === generationRef.current && setComicScores(data.scores ?? {}))
        .catch(() => undefined);
    }

    return () => controller.abort();
  }, [query, loadSource]);

  // Back to the top of the list whenever the view changes
  useEffect(() => {
    setDisplayCount(DISPLAY_STEP);
  }, [activeFilters, authorFilter, sortOrder, libraryFilter]);

  const handleFilterToggle = useCallback((value: MediaType | "all") => {
    setActiveFilters((prev) => {
      const next = new Set(prev);

      if (value === "all") {
        // Clicking "Tous" resets to show all
        return new Set(["all"]);
      }

      // Remove "all" when selecting a specific filter
      next.delete("all");

      if (next.has(value)) {
        next.delete(value);
        // If nothing selected, go back to "all"
        if (next.size === 0) return new Set(["all"]);
      } else {
        next.add(value);
        // If all 3 types are selected, simplify to "all"
        if (next.size === MEDIA_TYPES.length) return new Set(["all"]);
      }

      return next;
    });
  }, []);

  // Distinct authors among loaded results, alphabetically sorted
  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.author) set.add(r.author);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [results]);

  const filteredResults = useMemo(() => {
    let list = activeFilters.has("all")
      ? results
      : results.filter((r) => activeFilters.has(r.type));

    if (authorFilter) {
      list = list.filter((r) => r.author === authorFilter);
    }

    if (libraryFilter !== "all") {
      list = list.filter((r) => (libraryFilter === "available" ? isInLibrary(r) : !isInLibrary(r)));
    }

    if (sortOrder === "popularity") {
      list = sortByPopularity(list, comicScores, query);
    } else if (sortOrder === "volumes") {
      // Nombre inconnu en dernier
      list = [...list].sort((a, b) => (b.volumeCount ?? -1) - (a.volumeCount ?? -1));
    } else if (sortOrder === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }));
    } else if (sortOrder !== "relevance") {
      const dir = sortOrder === "newest" ? -1 : 1;
      // Results without a year always go last
      list = [...list].sort((a, b) => {
        if (a.year === null && b.year === null) return 0;
        if (a.year === null) return 1;
        if (b.year === null) return -1;
        return (a.year - b.year) * dir;
      });
    }

    return list;
  }, [results, activeFilters, authorFilter, sortOrder, libraryFilter, comicScores, query]);

  const displayedResults = useMemo(
    () => filteredResults.slice(0, displayCount),
    [filteredResults, displayCount]
  );
  const hasHiddenCards = displayCount < filteredResults.length;

  // Reveal more cards when the bottom of the grid comes into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasHiddenCards) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDisplayCount((c) => c + DISPLAY_STEP);
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasHiddenCards, displayCount]);

  const allDone = MEDIA_TYPES.every((t) => sources[t].done);
  const firstPagesDone = MEDIA_TYPES.every((t) => sources[t].loadedPages >= 1 || sources[t].done);
  const count = filteredResults.length;

  // Progress over the pages we know about (unknown counts assume one more page)
  const progress = useMemo(() => {
    let loaded = 0;
    let expected = 0;
    for (const t of MEDIA_TYPES) {
      const s = sources[t];
      loaded += s.loadedPages;
      expected += s.done ? s.loadedPages : Math.max(s.totalPages ?? s.loadedPages + 1, s.loadedPages + 1);
    }
    return expected > 0 ? Math.round((loaded / expected) * 100) : 0;
  }, [sources]);

  const cappedSources = MEDIA_TYPES.filter((t) => sources[t].capped);
  const failedSources = MEDIA_TYPES.filter((t) => sources[t].failed);

  return (
    <div className="page-content">
      <div className="container">
        <div style={{ paddingTop: 24, paddingBottom: 8 }}>
          <SearchBar defaultQuery={query} compact />
        </div>

        {query && (
          <div className="page-header">
            <h1 className="page-title">
              Résultats pour &laquo;{query}&raquo;
            </h1>
            <p className="page-subtitle">
              {`${count} résultat${count !== 1 ? "s" : ""}`}
              {!allDone && " — chargement de tous les résultats…"}
            </p>
            {!allDone && firstPagesDone && (
              <div
                className="search-progress"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="search-progress-bar" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        {matchedAuthors.length > 0 && (
          <div className="search-notice search-notice-author">
            ✍️ Œuvres de <strong>{matchedAuthors.join(", ")}</strong> affichées en premier.
          </div>
        )}

        {allDone && cappedSources.length > 0 && (
          <div className="search-notice">
            Cette recherche est très large : seuls les{" "}
            {cappedSources
              .map((t) => {
                const s = sources[t];
                const shown = results.filter((r) => r.type === t).length;
                return `${shown.toLocaleString("fr-FR")} premiers ${TYPE_LABELS[t]}${s.total ? ` (sur ${s.total.toLocaleString("fr-FR")})` : ""}`;
              })
              .join(" et ")}{" "}
            sont chargés. Précisez votre recherche pour trouver les autres.
          </div>
        )}

        {allDone && failedSources.length > 0 && (
          <div className="search-notice">
            Certains résultats {failedSources.map((t) => TYPE_LABELS[t]).join(" et ")} n&apos;ont
            pas pu être chargés (source indisponible ou quota atteint). Réessayez plus tard.
          </div>
        )}

        {/* Category filter chips */}
        {results.length > 0 && (
          <div className="filter-chips">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.value}
                className={`filter-chip ${activeFilters.has(f.value) ? "active" : ""}`}
                onClick={() => handleFilterToggle(f.value)}
                type="button"
              >
                {f.emoji} {f.label}
                {f.value !== "all" && (
                  <span className="filter-chip-count">
                    {results.filter((r) => r.type === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Sort & author filters */}
        {results.length > 0 && (
          <div className="filter-selects">
            <label className="filter-select">
              <span className="filter-select-label">Trier par</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                disabled={!allDone}
                title={
                  !allDone
                    ? "Disponible une fois tous les résultats chargés"
                    : sortOrder === "popularity"
                      ? "Mangas : lecteurs AniList · Comics & BD : lecteurs Open Library"
                      : undefined
                }
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-select">
              <span className="filter-select-label">Bibliothèque</span>
              <select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value as LibraryFilter)}>
                {LIBRARY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {authors.length > 0 && (
              <label className="filter-select">
                <span className="filter-select-label">Auteur</span>
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                >
                  <option value="">Tous les auteurs</option>
                  {authors.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <MediaGrid
          results={displayedResults}
          loading={!firstPagesDone && results.length === 0}
        />

        {/* Reveals more cards on scroll */}
        <div ref={sentinelRef} className="search-more">
          {hasHiddenCards && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setDisplayCount((c) => c + DISPLAY_STEP)}
            >
              Afficher plus ({(filteredResults.length - displayCount).toLocaleString("fr-FR")} restants)
            </button>
          )}
          {!hasHiddenCards && allDone && results.length > 0 && (
            <span className="search-more-end">Tous les résultats sont affichés</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content">
          <div className="container">
            <MediaGrid results={[]} loading />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
