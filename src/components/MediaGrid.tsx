"use client";

import type { MediaResult } from "@/lib/types";
import MediaCard from "./MediaCard";

interface MediaGridProps {
  results: MediaResult[];
  loading?: boolean;
}

export default function MediaGrid({ results, loading = false }: MediaGridProps) {
  if (loading) {
    return (
      <div className="media-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Aucun résultat trouvé</div>
        <p>Essayez de modifier votre recherche ou de changer le type de média.</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {results.map((media) => (
        <MediaCard key={`${media.type}-${media.id}`} media={media} />
      ))}
    </div>
  );
}
