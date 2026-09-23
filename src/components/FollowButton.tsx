"use client";

import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
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

  return (
    <div className="follow-box">
      <button
        type="button"
        className={`btn btn-secondary ${follow ? "following" : ""}`}
        onClick={() => (follow ? unfollow() : save(false))}
        disabled={busy}
        title={follow ? "Ne plus suivre cette série" : undefined}
      >
        {busy ? <LoadingSpinner /> : follow ? "★" : "☆"} {follow ? "Série suivie" : "Suivre la série"}
      </button>

      {follow && (
        <div className="follow-options">
          <p className="request-note" style={{ marginTop: 0 }}>
            Vous serez prévenu par email à l&apos;arrivée de nouveaux {media.type === "comic" ? "numéros" : "tomes"} dans
            la bibliothèque.
          </p>
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
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
