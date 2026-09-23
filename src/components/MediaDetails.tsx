"use client";

import { useRouter } from "next/navigation";
import type { DetailAvailability, MediaDetail } from "@/lib/types";
import AvailabilityBadge from "./AvailabilityBadge";
import RequestButton from "./RequestButton";

interface MediaDetailsProps {
  detail: MediaDetail;
  state: DetailAvailability | null;
}

export default function MediaDetails({ detail, state }: MediaDetailsProps) {
  const router = useRouter();
  const bgImage = detail.bannerUrl || detail.coverUrl;

  // Go back to the previous page (search results); fall back to home when the
  // details page was opened directly (new tab, shared link)
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // Series span: "1997 – en cours", "2004 – 2010", or just the start year
  const endYear = detail.endDate ? parseInt(detail.endDate.substring(0, 4), 10) : null;
  const yearLabel = !detail.year
    ? null
    : endYear && endYear !== detail.year
      ? `${detail.year} – ${endYear}`
      : detail.status === "En cours" || detail.status === "En pause"
        ? `${detail.year} – en cours`
        : String(detail.year);

  return (
    <div className="details-hero">
      {bgImage && (
        <>
          <div className="details-hero-bg" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="details-hero-overlay" />
        </>
      )}

      <div className="details-back-bar">
        <button type="button" className="details-back" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Retour
        </button>
      </div>

      <div className="details-content">
        {/* Cover */}
        <div className="details-cover">
          {detail.coverUrl ? (
            <img src={detail.coverUrl} alt={detail.title} />
          ) : (
            <div className="media-card-no-image" style={{ fontSize: "4rem" }}>📚</div>
          )}
        </div>

        {/* Info */}
        <div className="details-info">
          <h1 className="details-title">{detail.title}</h1>

          {/* Meta pills */}
          <div className="details-meta">
            <span className={`media-card-badge ${detail.type}`} style={{ position: "static" }}>
              {detail.type === "manga" ? "🇯🇵 Manga" : "📘 Comic / BD"}
            </span>

            {yearLabel && (
              <div className="details-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {yearLabel}
              </div>
            )}

            {detail.author && (
              <div className="details-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {detail.author}
              </div>
            )}

            {detail.publisher && (
              <div className="details-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                {detail.publisher}
              </div>
            )}

            {detail.status && (
              <div className="details-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {detail.status}
              </div>
            )}

            {detail.volumes.length > 0 && (
              <div className="details-meta-item">
                📖 {detail.volumes.length} tome{detail.volumes.length > 1 ? "s" : ""}
              </div>
            )}

            {detail.chapters && (
              <div className="details-meta-item">
                📄 {detail.chapters} chapitre{detail.chapters > 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Genres */}
          {detail.genres.length > 0 && (
            <div className="details-genres">
              {detail.genres.map((genre) => (
                <span key={genre} className="details-genre">{genre}</span>
              ))}
            </div>
          )}

          {/* Description */}
          {detail.description && (
            <p className="details-description">{detail.description}</p>
          )}

          {/* Bibliothèque et demandes des autres lecteurs */}
          {state && (state.availability || state.otherRequests > 0) && (
            <div className="details-library">
              {state.availability && (
                <AvailabilityBadge
                  availability={state.availability}
                  volumeCount={detail.volumes.length || detail.volumeCount}
                  inline
                />
              )}
              {state.library && (
                <span>
                  {state.library.booksCount} tome{state.library.booksCount > 1 ? "s" : ""} dans{" "}
                  {state.library.url ? (
                    <a href={state.library.url} target="_blank" rel="noopener noreferrer">
                      {state.library.name}
                    </a>
                  ) : (
                    state.library.name
                  )}
                </span>
              )}
              {state.otherRequests > 0 && (
                <span>
                  · Déjà demandé par {state.otherRequests} autre{state.otherRequests > 1 ? "s" : ""} lecteur
                  {state.otherRequests > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Request Button */}
          <RequestButton media={detail} state={state} />
        </div>
      </div>
    </div>
  );
}
