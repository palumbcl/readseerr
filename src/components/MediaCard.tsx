"use client";

import { useRouter } from "next/navigation";
import AvailabilityBadge from "./AvailabilityBadge";
import type { MediaResult } from "@/lib/types";
import CoverImage from "@/components/CoverImage";

interface MediaCardProps {
  media: MediaResult;
}

export default function MediaCard({ media }: MediaCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/details/${media.type}/${media.id}`);
  };

  // Many series share a name (dozens of "Spider-Man" volumes), so show what tells them apart
  const meta = [media.year, media.publisher ?? media.author].filter(Boolean).join(" · ");
  const count = media.volumeCount
    ? `${media.volumeCount} ${media.type === "comic" ? "numéro" : "tome"}${media.volumeCount > 1 ? "s" : ""}`
    : null;

  return (
    <div className="media-card" onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleClick()}>
      {media.coverUrl ? (
        <CoverImage
          className="media-card-image"
          src={media.coverUrl}
          alt={media.title}
          fill
          sizes="(max-width: 600px) 45vw, 200px"
        />
      ) : (
        <div className="media-card-no-image">📚</div>
      )}

      <span className={`media-card-badge ${media.type}`}>
        {media.type === "manga" ? "Manga" : "Comic / BD"}
      </span>

      {media.availability && (
        <AvailabilityBadge availability={media.availability} volumeCount={media.volumeCount} />
      )}

      <div className="media-card-overlay">
        <div className="media-card-title">{media.title}</div>
        {meta && <div className="media-card-year">{meta}</div>}
        {count && <div className="media-card-year">{count}</div>}
      </div>
    </div>
  );
}
