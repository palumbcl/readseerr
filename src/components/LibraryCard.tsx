"use client";

import type { LibraryRecentItem } from "@/lib/types";

/** Série récemment ajoutée dans Komga : ouvre directement la série dans Komga. */
export default function LibraryCard({ item }: { item: LibraryRecentItem }) {
  const content = (
    <>
      <img className="media-card-image" src={item.thumbnailUrl} alt={item.name} loading="lazy" />
      <span className="availability-badge available">Disponible</span>
      <div className="media-card-overlay">
        <div className="media-card-title">{item.name}</div>
        <div className="media-card-year">
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
