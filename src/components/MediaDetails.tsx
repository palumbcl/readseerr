"use client";

import type { MediaDetail } from "@/lib/types";
import RequestButton from "./RequestButton";

interface MediaDetailsProps {
  detail: MediaDetail;
}

export default function MediaDetails({ detail }: MediaDetailsProps) {
  const bgImage = detail.bannerUrl || detail.coverUrl;

  return (
    <div className="details-hero">
      {bgImage && (
        <>
          <div className="details-hero-bg" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="details-hero-overlay" />
        </>
      )}

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
              {detail.type === "manga" ? "🇯🇵 Manga" : detail.type === "comic" ? "🇺🇸 Comic" : "🇫🇷 BD"}
            </span>

            {detail.year && (
              <div className="details-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {detail.year}
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

          {/* Request Button */}
          <RequestButton media={detail} />
        </div>
      </div>
    </div>
  );
}
