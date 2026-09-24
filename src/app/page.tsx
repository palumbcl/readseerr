"use client";

import { useEffect, useState } from "react";
import MediaCard from "@/components/MediaCard";
import LibraryCard from "@/components/LibraryCard";
import DiscoverRow from "@/components/DiscoverRow";
import type { DiscoverResponse } from "@/lib/types";

function SkeletonRow() {
  return (
    <section className="discover-row" aria-hidden>
      <div className="discover-row-header">
        <div className="skeleton discover-skeleton-title" />
      </div>
      <div className="discover-row-track">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/discover");
        if (!response.ok) throw new Error();
        setDiscover(await response.json());
      } catch {
        setError(true);
      }
    })();
  }, []);

  return (
    <main className="page-content">
      <div className="container discover">
        {!discover && !error && (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {error && (
          <p className="request-note" style={{ textAlign: "center" }}>
            Impossible de charger les suggestions pour le moment. La recherche reste disponible.
          </p>
        )}

        {discover?.library && discover.library.length > 0 && (
          <DiscoverRow
            title="Ajouts récents"
            subtitle="Nouvelles séries et nouveaux tomes dans la bibliothèque"
            href={discover.libraryHasMore ? "/discover/library" : undefined}
          >
            {discover.library.map((item) => (
              <LibraryCard key={item.id} item={item} />
            ))}
          </DiscoverRow>
        )}

        {discover?.rows.map((row) => (
          <DiscoverRow
            key={row.id}
            title={row.title}
            subtitle={row.subtitle}
            href={row.hasMore ? `/discover/${row.id}` : undefined}
          >
            {row.items.map((media) => (
              <MediaCard key={`${media.type}-${media.id}`} media={media} />
            ))}
          </DiscoverRow>
        ))}
      </div>
    </main>
  );
}
