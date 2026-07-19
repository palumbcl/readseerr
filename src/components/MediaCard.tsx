"use client";

import { useRouter } from "next/navigation";
import type { MediaResult } from "@/lib/types";

interface MediaCardProps {
  media: MediaResult;
}

export default function MediaCard({ media }: MediaCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/details/${media.type}/${media.id}`);
  };

  return (
    <div className="media-card" onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleClick()}>
      {media.coverUrl ? (
        <img
          className="media-card-image"
          src={media.coverUrl}
          alt={media.title}
          loading="lazy"
        />
      ) : (
        <div className="media-card-no-image">📚</div>
      )}

      <span className={`media-card-badge ${media.type}`}>
        {media.type === "manga" ? "Manga" : media.type === "comic" ? "Comic" : "BD"}
      </span>

      <div className="media-card-overlay">
        <div className="media-card-title">{media.title}</div>
        {media.year && <div className="media-card-year">{media.year}</div>}
        {media.author && (
          <div className="media-card-year">{media.author}</div>
        )}
      </div>
    </div>
  );
}
