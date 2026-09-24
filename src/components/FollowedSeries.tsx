"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";
import type { FollowedSeries as Followed } from "@/lib/types";
import CoverImage from "@/components/CoverImage";

/** Séries suivies par l'utilisateur, avec désabonnement et option de demande automatique. */
export default function FollowedSeries() {
  const [follows, setFollows] = useState<Followed[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/follow");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setFollows(data.follows);
      } catch {
        setFollows([]);
      }
    })();
  }, []);

  const keyOf = (f: Followed) => `${f.mediaType}:${f.externalId}`;

  const unfollow = async (follow: Followed) => {
    setBusyKey(keyOf(follow));
    setError("");
    try {
      const params = new URLSearchParams({ mediaType: follow.mediaType, externalId: follow.externalId });
      const response = await fetch(`/api/follow?${params}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      setFollows((prev) => prev?.filter((f) => keyOf(f) !== keyOf(follow)) ?? null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusyKey(null);
    }
  };

  const setAutoRequest = async (follow: Followed, autoRequest: boolean) => {
    setBusyKey(keyOf(follow));
    setError("");
    try {
      const response = await fetch("/api/follow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: follow.mediaType,
          externalId: follow.externalId,
          title: follow.title,
          coverUrl: follow.coverUrl ?? undefined,
          volumeCount: follow.volumeCount,
          autoRequest,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setFollows((prev) => prev?.map((f) => (keyOf(f) === keyOf(follow) ? { ...f, autoRequest } : f)) ?? null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusyKey(null);
    }
  };

  if (follows === null) {
    return (
      <div className="loading-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (follows.length === 0) {
    return (
      <p className="request-note" style={{ marginBottom: 32 }}>
        Vous ne suivez aucune série. Utilisez « Suivre la série » sur une fiche pour être prévenu des nouveaux tomes.
      </p>
    );
  }

  return (
    <>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="followed-list">
        {follows.map((follow) => (
          <div key={keyOf(follow)} className="followed-item">
            {follow.coverUrl ? (
              <CoverImage src={follow.coverUrl} alt="" width={56} height={84} />
            ) : (
              <div className="admin-request-no-cover">📚</div>
            )}
            <div className="followed-item-info">
              <Link
                href={`/details/${follow.mediaType}/${encodeURIComponent(follow.externalId)}`}
                className="followed-item-title"
              >
                {follow.title}
              </Link>
              <span className="request-note" style={{ marginTop: 0 }}>
                {follow.libraryBooksCount
                  ? `${follow.libraryBooksCount} ${follow.mediaType === "comic" ? "numéro" : "tome"}${follow.libraryBooksCount > 1 ? "s" : ""} dans la bibliothèque`
                  : "Pas encore dans la bibliothèque"}
              </span>
              {follow.mediaType === "comic" && (
                <label className="follow-toggle" style={{ fontSize: "0.8rem" }}>
                  <input
                    type="checkbox"
                    checked={follow.autoRequest}
                    disabled={busyKey === keyOf(follow)}
                    onChange={(e) => setAutoRequest(follow, e.target.checked)}
                  />
                  Demande auto des nouveaux numéros
                </label>
              )}
              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => unfollow(follow)}
                  disabled={busyKey === keyOf(follow)}
                >
                  Ne plus suivre
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
