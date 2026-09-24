"use client";

import Link from "next/link";
import AvailabilityBadge from "./AvailabilityBadge";
import type { MediaResult } from "@/lib/types";
import CoverImage from "@/components/CoverImage";
import { BookOpenIcon } from "@/components/Icons";

interface MediaCardProps {
  media: MediaResult;
}

export default function MediaCard({ media }: MediaCardProps) {
  // Many series share a name (dozens of "Spider-Man" volumes), so show what tells them apart
  const meta = [media.year, media.publisher ?? media.author].filter(Boolean).join(" · ");
  const count = media.volumeCount
    ? `${media.volumeCount} ${media.type === "comic" ? "numéro" : "tome"}${media.volumeCount > 1 ? "s" : ""}`
    : null;

  return (
    <Link href={`/details/${media.type}/${media.id}`} className="media-card" title={media.title}>
      {media.coverUrl ? (
        <CoverImage
          className="media-card-image"
          src={media.coverUrl}
          alt={media.title}
          fill
          sizes="(max-width: 600px) 45vw, 200px"
        />
      ) : (
        <div className="media-card-no-image">
          <BookOpenIcon size={40} />
        </div>
      )}

      <div className="media-card-top">
        <span className={`type-badge ${media.type}`}>{media.type === "manga" ? "Manga" : "Comic"}</span>
        {media.availability && (
          <AvailabilityBadge availability={media.availability} volumeCount={media.volumeCount} />
        )}
      </div>

      <div className="media-card-overlay">
        {meta && <div className="media-card-year">{meta}</div>}
        <div className="media-card-title">{media.title}</div>
        {count && <div className="media-card-count">{count}</div>}
      </div>
    </Link>
  );
}
