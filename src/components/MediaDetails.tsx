"use client";

import { useRouter } from "next/navigation";
import type { DetailAvailability, MediaDetail } from "@/lib/types";
import AvailabilityBadge from "./AvailabilityBadge";
import RequestButton from "./RequestButton";
import FollowButton from "./FollowButton";
import ReportIssueButton from "./ReportIssueButton";
import CoverImage from "@/components/CoverImage";
import { BookOpenIcon, ChevronLeftIcon, TagIcon } from "@/components/Icons";

interface MediaDetailsProps {
  detail: MediaDetail;
  state: DetailAvailability | null;
}

export default function MediaDetails({ detail, state }: MediaDetailsProps) {
  const router = useRouter();
  const bgImage = detail.bannerUrl || detail.coverUrl;
  const unit = detail.type === "comic" ? "numéro" : "tome";
  const volumeCount = detail.volumes.length || detail.volumeCount || 0;

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

  const attributes = [
    volumeCount > 0 && `${volumeCount} ${unit}${volumeCount > 1 ? "s" : ""}`,
    detail.genres.length > 0 && detail.genres.slice(0, 4).join(", "),
  ].filter(Boolean);

  const people = [
    detail.author && { job: "Auteur", name: detail.author },
    detail.publisher && { job: "Éditeur", name: detail.publisher },
  ].filter(Boolean) as { job: string; name: string }[];

  const altTitles = (detail.altTitles ?? []).filter((t) => t && t !== detail.title).slice(0, 3);

  return (
    <div className="media-page">
      {bgImage && (
        <div className="media-page-bg" aria-hidden>
          <div className="media-page-bg-image" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="media-page-bg-gradient" />
        </div>
      )}

      <button type="button" className="media-back" onClick={handleBack} aria-label="Retour">
        <ChevronLeftIcon size={22} />
      </button>

      <div className="media-header">
        <div className="media-poster">
          {detail.coverUrl ? (
            <CoverImage src={detail.coverUrl} alt={detail.title} fill sizes="(max-width: 768px) 128px, 208px" priority />
          ) : (
            <div className="media-card-no-image">
              <BookOpenIcon size={48} />
            </div>
          )}
        </div>

        <div className="media-title">
          <div className="media-status">
            <span className={`type-badge ${detail.type}`}>{detail.type === "manga" ? "Manga" : "Comic"}</span>
            {state?.availability && (
              <AvailabilityBadge availability={state.availability} volumeCount={volumeCount} inline />
            )}
          </div>
          <h1>
            {detail.title}
            {yearLabel && <span className="media-year"> ({yearLabel})</span>}
          </h1>
          {attributes.length > 0 && (
            <span className="media-attributes">
              {attributes.map((attr, i) => (
                <span key={i}>
                  {i > 0 && <span className="media-attributes-sep">|</span>}
                  {attr}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* Les boutons des trois composants se rangent sur une ligne, leurs messages en dessous */}
        <div className="media-actions">
          <RequestButton media={detail} state={state} />
          {state && <FollowButton media={detail} initialFollow={state.follow} />}
          {/* Signalement : seulement pour ce qui est dans la bibliothèque */}
          {state?.library && <ReportIssueButton media={detail} libraryVolumes={state.library.volumes} />}
        </div>
      </div>

      <div className="media-overview">
        <div className="media-overview-left">
          <h2>Résumé</h2>
          <p className="media-overview-text">{detail.description || "Aucun résumé disponible."}</p>

          {people.length > 0 && (
            <ul className="media-crew">
              {people.map((person) => (
                <li key={person.job}>
                  <span className="media-crew-job">{person.job}</span>
                  <span className="media-crew-name">{person.name}</span>
                </li>
              ))}
            </ul>
          )}

          {detail.genres.length > 0 && (
            <div className="media-tags">
              {detail.genres.map((genre) => (
                <span key={genre} className="media-tag">
                  <TagIcon size={16} />
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="media-overview-right">
          <div className="media-facts">
            {altTitles.length > 0 && (
              <div className="media-fact">
                <span>Autres titres</span>
                <span className="media-fact-value">
                  {altTitles.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </span>
              </div>
            )}
            {detail.status && (
              <div className="media-fact">
                <span>Statut</span>
                <span className="media-fact-value">{detail.status}</span>
              </div>
            )}
            {yearLabel && (
              <div className="media-fact">
                <span>Publication</span>
                <span className="media-fact-value">{yearLabel}</span>
              </div>
            )}
            {volumeCount > 0 && (
              <div className="media-fact">
                <span>{detail.type === "comic" ? "Numéros" : "Tomes"}</span>
                <span className="media-fact-value">{volumeCount}</span>
              </div>
            )}
            {detail.chapters && (
              <div className="media-fact">
                <span>Chapitres</span>
                <span className="media-fact-value">{detail.chapters}</span>
              </div>
            )}
            {detail.publisher && (
              <div className="media-fact">
                <span>Éditeur</span>
                <span className="media-fact-value">{detail.publisher}</span>
              </div>
            )}
            {state?.library && (
              <div className="media-fact">
                <span>Bibliothèque</span>
                <span className="media-fact-value">
                  <span>
                    {state.library.booksCount} {unit}
                    {state.library.booksCount > 1 ? "s" : ""}
                  </span>
                  {state.library.url ? (
                    <a href={state.library.url} target="_blank" rel="noopener noreferrer">
                      {state.library.name}
                    </a>
                  ) : (
                    <span>{state.library.name}</span>
                  )}
                </span>
              </div>
            )}
            {state && state.otherRequests > 0 && (
              <div className="media-fact">
                <span>Autres demandes</span>
                <span className="media-fact-value">
                  {state.otherRequests} lecteur{state.otherRequests > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
