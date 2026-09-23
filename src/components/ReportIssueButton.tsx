"use client";

import { useState } from "react";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";
import { ISSUE_TYPE_LABELS, type IssueType, type MediaDetail } from "@/lib/types";

interface ReportIssueButtonProps {
  media: MediaDetail;
  /** Tomes présents dans Komga, pour choisir celui qui pose problème */
  libraryVolumes: number[] | null;
}

const ISSUE_TYPES = Object.keys(ISSUE_TYPE_LABELS) as IssueType[];

/** Signaler un problème sur une œuvre présente dans la bibliothèque. */
export default function ReportIssueButton({ media, libraryVolumes }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IssueType>("bad_file");
  const [volume, setVolume] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const unit = media.type === "comic" ? "numéro" : "tome";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: media.type,
          externalId: media.id,
          title: media.title,
          coverUrl: media.coverUrl || undefined,
          altTitles: media.altTitles,
          volumeCount: media.volumes.length || media.volumeCount || null,
          year: media.year,
          type,
          volume: volume ? parseInt(volume, 10) : null,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCreatedId(data.issue.id);
      setOpen(false);
      setMessage("");
      setVolume("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible d'envoyer le signalement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-issue">
      <button type="button" className="btn-link" onClick={() => setOpen(true)}>
        ⚠️ Signaler un problème
      </button>
      {createdId && (
        <p className="request-note">
          Merci ! Votre signalement a été transmis.{" "}
          <Link href={`/issues/${createdId}`}>Suivre la discussion</Link>
        </p>
      )}

      {open && (
        <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Signaler un problème</h3>

            <div className="form-group">
              <span className="form-label">Type de problème</span>
              <div className="issue-type-list">
                {ISSUE_TYPES.map((t) => (
                  <label key={t} className={`modal-volume-item ${type === t ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="issue-type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="visually-hidden"
                    />
                    <div className="modal-volume-checkbox">{type === t && "✓"}</div>
                    <span>{ISSUE_TYPE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="issue-volume">
                {unit.charAt(0).toUpperCase() + unit.slice(1)} concerné (facultatif)
              </label>
              {libraryVolumes && libraryVolumes.length > 0 && type !== "missing_volume" ? (
                <select id="issue-volume" className="form-input" value={volume} onChange={(e) => setVolume(e.target.value)}>
                  <option value="">Toute la série</option>
                  {libraryVolumes.map((n) => (
                    <option key={n} value={n}>
                      {unit.charAt(0).toUpperCase() + unit.slice(1)} {n}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="issue-volume"
                  className="form-input"
                  type="number"
                  min={1}
                  value={volume}
                  placeholder={`Numéro du ${unit}`}
                  onChange={(e) => setVolume(e.target.value)}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="issue-message">
                Description
              </label>
              <textarea
                id="issue-message"
                className="form-input issue-textarea"
                rows={4}
                maxLength={2000}
                placeholder="Ex. : les pages 40 à 52 sont blanches, le tome 3 est en espagnol…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={busy || !message.trim()}>
                {busy ? <LoadingSpinner /> : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
