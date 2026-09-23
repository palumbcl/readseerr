"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ISSUE_TYPE_LABELS, type IssueDetail } from "@/lib/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export default function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setIssue(data.issue);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : "Signalement introuvable.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<Response>) => {
    setBusy(true);
    setActionError("");
    try {
      const response = await action();
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error && err.message ? err.message : "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const ok = await run(() =>
      fetch(`/api/issues/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      })
    );
    if (ok) setReply("");
  };

  const toggleStatus = () =>
    run(() =>
      fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: issue?.status === "open" ? "resolved" : "open" }),
      })
    );

  if (loadError) {
    return (
      <div className="page-content">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">😕</div>
            <div className="empty-state-title">{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const unit = issue.media.mediaType === "comic" ? "Numéro" : "Tome";

  return (
    <div className="page-content">
      <div className="container issue-page">
        <div className="issue-header">
          {issue.media.coverUrl && <img src={issue.media.coverUrl} alt="" className="issue-header-cover" />}
          <div>
            <p className="page-subtitle" style={{ marginTop: 0 }}>Signalement</p>
            <h1 className="page-title">{issue.media.title}</h1>
            <div className="admin-request-meta">
              <span className={`status-badge ${issue.status === "open" ? "pending" : "available"}`}>
                {issue.status === "open" ? "Ouvert" : "Résolu"}
              </span>
              <span>{ISSUE_TYPE_LABELS[issue.type] ?? issue.type}</span>
              {issue.volume && (
                <span>
                  {unit} {issue.volume}
                </span>
              )}
              <Link href={`/details/${issue.media.mediaType}/${encodeURIComponent(issue.media.externalId)}`}>
                Fiche de l&apos;œuvre
              </Link>
              {issue.libraryUrl && (
                <a href={issue.libraryUrl} target="_blank" rel="noopener noreferrer">
                  Ouvrir dans Komga
                </a>
              )}
            </div>
            {issue.status === "resolved" && issue.resolvedAt && (
              <p className="request-note">
                Résolu le {formatDateTime(issue.resolvedAt)}
                {issue.resolvedBy ? ` par ${issue.resolvedBy.name}` : ""}.
              </p>
            )}
          </div>
        </div>

        <div className="issue-thread">
          <div className="issue-message">
            <div className="issue-message-meta">
              <strong>{issue.user.name}</strong> · {formatDateTime(issue.createdAt)}
            </div>
            <p>{issue.message}</p>
          </div>
          {issue.comments.map((comment) => (
            <div key={comment.id} className={`issue-message ${comment.user.isAdmin ? "from-admin" : ""}`}>
              <div className="issue-message-meta">
                <strong>{comment.user.name}</strong>
                {comment.user.isAdmin && <span className="role-badge admin" style={{ marginLeft: 8 }}>Admin</span>} ·{" "}
                {formatDateTime(comment.createdAt)}
              </div>
              <p>{comment.message}</p>
            </div>
          ))}
        </div>

        <div className="issue-reply">
          <textarea
            className="form-input issue-textarea"
            rows={3}
            maxLength={2000}
            placeholder="Votre réponse…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {actionError && <p className="form-error">{actionError}</p>}
          <div className="request-followup-actions">
            <button className="btn btn-primary" onClick={sendReply} disabled={busy || !reply.trim()}>
              {busy ? <LoadingSpinner /> : "Répondre"}
            </button>
            {issue.canManage && (
              <button className="btn btn-secondary" onClick={toggleStatus} disabled={busy}>
                {issue.status === "open" ? "Marquer comme résolu" : "Rouvrir"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
