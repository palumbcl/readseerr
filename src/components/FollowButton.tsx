"use client";

import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { StarIcon } from "./Icons";
import type { MediaDetail, RequestPayload } from "@/lib/types";

interface FollowButtonProps {
  media: MediaDetail;
  initialFollow: { autoRequest: boolean } | null;
}

/** Suivre une série : notification des nouveaux tomes, et demande automatique des nouveaux numéros (comics). */
export default function FollowButton({ media, initialFollow }: FollowButtonProps) {
  const [follow, setFollow] = useState(initialFollow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (autoRequest: boolean) => {
    setBusy(true);
    setError("");
    try {
      const payload: RequestPayload & { autoRequest: boolean } = {
        mediaType: media.type,
        externalId: media.id,
        title: media.title,
        coverUrl: media.coverUrl || undefined,
        altTitles: media.altTitles,
        volumeCount: media.volumes.length || media.volumeCount || null,
        year: media.year,
        autoRequest,
      };
      const response = await fetch("/api/follow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFollow(data.follow);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const unfollow = async () => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ mediaType: media.type, externalId: media.id });
      const response = await fetch(`/api/follow?${params}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      setFollow(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  const unit = media.type === "comic" ? "numéros" : "tomes";

  return (
    <>
      <button
        type="button"
        className={`btn btn-secondary btn-icon ${follow ? "following" : ""}`}
        onClick={() => (follow ? unfollow() : save(false))}
        disabled={busy}
        title={follow ? "Ne plus suivre cette série" : `Suivre la série (nouveaux ${unit})`}
        aria-label={follow ? "Ne plus suivre cette série" : "Suivre la série"}
        aria-pressed={!!follow}
      >
        {busy ? <LoadingSpinner /> : <StarIcon size={20} filled={!!follow} />}
      </button>

      {follow && (
        <div className="action-note follow-options">
          <span>
            Série suivie : vous serez prévenu à l&apos;arrivée de nouveaux {unit} dans la bibliothèque.
          </span>
          {media.type === "comic" && (
            <label className="follow-toggle">
              <input
                type="checkbox"
                checked={follow.autoRequest}
                disabled={busy}
                onChange={(e) => save(e.target.checked)}
              />
              Demander automatiquement les nouveaux numéros dès leur sortie
            </label>
          )}
        </div>
      )}
      {error && <p className="action-note form-error">{error}</p>}
    </>
  );
}
