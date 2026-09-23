"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MediaGrid from "@/components/MediaGrid";
import LibraryCard from "@/components/LibraryCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { DiscoverRowPage, LibraryRecentItem, MediaResult } from "@/lib/types";

/** Page « Voir tout » d'une rangée de Découvrir, chargée page par page. */
export default function DiscoverRowFullPage() {
  const { row } = useParams<{ row: string }>();
  const [header, setHeader] = useState<{ title: string; subtitle: string; kind: DiscoverRowPage["kind"] } | null>(null);
  const [items, setItems] = useState<MediaResult[]>([]);
  const [library, setLibrary] = useState<LibraryRecentItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadNext = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const next = page + 1;
      const response = await fetch(`/api/discover/${row}?page=${next}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const result = data as DiscoverRowPage;
      setHeader({ title: result.title, subtitle: result.subtitle, kind: result.kind });
      // Une série peut réapparaître d'une page à l'autre (ex. plusieurs numéros sortis) : dédoublonnage
      setItems((prev) => {
        const seen = new Set(prev.map((m) => `${m.type}-${m.id}`));
        return [...prev, ...result.items.filter((m) => !seen.has(`${m.type}-${m.id}`))];
      });
      setLibrary((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...result.library.filter((s) => !seen.has(s.id))];
      });
      setPage(next);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible de charger la suite.");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [row, page, hasMore, loading]);

  // Première page
  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  // Suite chargée à l'approche du bas de page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || page === 0) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadNext(), {
      rootMargin: "600px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, page, loadNext]);

  return (
    <div className="page-content">
      <div className="container">
        <div className="page-header">
          <Link href="/" className="details-back" style={{ marginBottom: 12, display: "inline-flex" }}>
            ‹ Découvrir
          </Link>
          <h1 className="page-title">{header?.title ?? "…"}</h1>
          {header && <p className="page-subtitle">{header.subtitle}</p>}
        </div>

        {header?.kind === "library" ? (
          <div className="library-grid">
            {library.map((item) => (
              <LibraryCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <MediaGrid results={items} loading={page === 0 && loading} />
        )}

        {error && <p className="form-error" style={{ textAlign: "center" }}>{error}</p>}

        <div ref={sentinelRef} className="search-more">
          {loading && page > 0 && <LoadingSpinner />}
          {!hasMore && page > 0 && !error && <span className="search-more-end">Tous les résultats sont affichés</span>}
        </div>
      </div>
    </div>
  );
}
