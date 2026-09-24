"use client";

import type { LibraryRecentItem } from "@/lib/types";
import { CheckIcon } from "@/components/Icons";

/** Série récemment ajoutée dans Komga : ouvre directement la série dans Komga. */
export default function LibraryCard({ item }: { item: LibraryRecentItem }) {
  const content = (
    <>
      <img className="media-card-image" src={item.thumbnailUrl} alt={item.name} loading="lazy" />
      <div className="media-card-top">
        <span className="type-badge library">Komga</span>
        <span className="availability-dot available" title="Disponible" aria-label="Disponible">
          <CheckIcon size={14} strokeWidth={3} />
        </span>
      </div>
      <div className="media-card-overlay">
        <div className="media-card-title">{item.name}</div>
        <div className="media-card-count">
          {item.booksCount} tome{item.booksCount > 1 ? "s" : ""}
        </div>
      </div>
    </>
  );

  return item.url ? (
    <a className="media-card" href={item.url} target="_blank" rel="noopener noreferrer" title={`Ouvrir ${item.name} dans Komga`}>
      {content}
    </a>
  ) : (
    <div className="media-card">{content}</div>
  );
}
