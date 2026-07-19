"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import SearchBar from "@/components/SearchBar";
import MediaGrid from "@/components/MediaGrid";
import type { MediaResult, MediaType } from "@/lib/types";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const type = (searchParams.get("type") || "manga") as MediaType;

  const [results, setResults] = useState<MediaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doSearch = useCallback(async () => {
    if (!query || query.length < 2) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${type}`
      );
      const data = await response.json();

      if (response.ok) {
        setResults(data.results || []);
      } else {
        setError(data.error || "Erreur de recherche.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  return (
    <div className="page-content">
      <div className="container">
        <div style={{ paddingTop: 24, paddingBottom: 8 }}>
          <SearchBar defaultQuery={query} defaultType={type} compact />
        </div>

        {query && (
          <div className="page-header">
            <h1 className="page-title">
              Résultats pour &laquo;{query}&raquo;
            </h1>
            <p className="page-subtitle">
              {!loading && `${results.length} résultat${results.length !== 1 ? "s" : ""} trouvé${results.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <MediaGrid results={results} loading={loading} />
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
