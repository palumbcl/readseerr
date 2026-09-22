"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback, useRef, useMemo } from "react";
import SearchBar from "@/components/SearchBar";
import MediaGrid from "@/components/MediaGrid";
import type { MediaResult, MediaType } from "@/lib/types";

const MEDIA_TYPES = ["manga", "comic", "bd"] as const;

const FILTER_OPTIONS: { value: MediaType | "all"; label: string; emoji: string }[] = [
  { value: "all", label: "Tous", emoji: "📚" },
  { value: "manga", label: "Manga", emoji: "🇯🇵" },
  { value: "comic", label: "Comic", emoji: "🇺🇸" },
  { value: "bd", label: "BD", emoji: "🇫🇷" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<MediaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const [error, setError] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<MediaType | "all">>(new Set(["all"]));
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async () => {
    if (!query || query.length < 2) return;

    // Cancel previous search
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setError("");
    setResults([]);
    setSourcesLoaded(0);
    setActiveFilters(new Set(["all"]));

    try {
      const accumulated: MediaResult[] = [];

      // Fire 3 parallel per-source requests
      const fetches = MEDIA_TYPES.map(async (type) => {
        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(query)}&type=${type}`,
            { signal }
          );
          const data = await response.json();
          const sourceResults: MediaResult[] = data.results || [];

          if (!signal.aborted) {
            accumulated.push(...sourceResults);
            setResults([...accumulated]);
            setSourcesLoaded((prev) => prev + 1);
          }
        } catch (err) {
          if (!signal.aborted) {
            // Source failed, still count it as loaded
            setSourcesLoaded((prev) => prev + 1);
            console.error(`Search error [${type}]:`, err);
          }
        }
      });

      await Promise.allSettled(fetches);

      if (!signal.aborted) {
        setLoading(false);
      }
    } catch {
      if (!signal.aborted) {
        setError("Erreur réseau.");
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    doSearch();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doSearch]);

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

  const filteredResults = useMemo(() => {
    if (activeFilters.has("all")) return results;
    return results.filter((r) => activeFilters.has(r.type));
  }, [results, activeFilters]);

  const allDone = sourcesLoaded >= MEDIA_TYPES.length;

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
              {allDone
                ? `${filteredResults.length} résultat${filteredResults.length !== 1 ? "s" : ""} trouvé${filteredResults.length !== 1 ? "s" : ""}`
                : `${filteredResults.length} résultat${filteredResults.length !== 1 ? "s" : ""} — recherche en cours…`}
            </p>
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

        {error && <div className="form-error">{error}</div>}

        <MediaGrid results={filteredResults} loading={loading && results.length === 0} />
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

