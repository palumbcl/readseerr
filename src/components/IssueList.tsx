"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";
import { ISSUE_TYPE_LABELS, type IssueRecord, type IssueStatus } from "@/lib/types";
import CoverImage from "@/components/CoverImage";
import { BookOpenIcon, ChatIcon, CheckIcon } from "./Icons";

interface IssueListProps {
  /** "all" : tous les signalements (admin) ; "mine" : ceux de l'utilisateur */
  scope: "all" | "mine";
  /** Masque les filtres et l'état vide (section compacte de « Mes demandes ») */
  compact?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function IssueList({ scope, compact = false }: IssueListProps) {
  const [status, setStatus] = useState<IssueStatus | "all">(compact ? "all" : "open");
  const [issues, setIssues] = useState<IssueRecord[] | null>(null);
  const [counts, setCounts] = useState<Record<IssueStatus, number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setIssues(null);
      setError("");
      try {
        const params = new URLSearchParams({ scope, ...(status !== "all" && { status }) });
        const response = await fetch(`/api/issues?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setIssues(data.issues);
        setCounts(data.counts);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Impossible de charger les signalements.");
        setIssues([]);
      }
    })();
  }, [scope, status]);

  const filters: { value: IssueStatus | "all"; label: string }[] = [
    { value: "open", label: "Ouverts" },
    { value: "resolved", label: "Résolus" },
    { value: "all", label: "Tous" },
  ];

  return (
    <div>
      {!compact && (
        <div className="filter-chips">
          {filters.map((f) => {
            const count = f.value === "all" ? (counts ? counts.open + counts.resolved : null) : counts?.[f.value];
            return (
              <button
                key={f.value}
                type="button"
                className={`filter-chip ${status === f.value ? "active" : ""}`}
                onClick={() => setStatus(f.value)}
              >
                {f.label}
                {count !== null && count !== undefined && <span className="filter-chip-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      {issues === null ? (
        <div className="loading-center">
          <LoadingSpinner />
        </div>
      ) : issues.length === 0 ? (
        compact ? (
          <p className="request-note" style={{ marginBottom: 32 }}>
            Aucun signalement. En cas de souci sur une œuvre de la bibliothèque, utilisez « Signaler un problème » sur
            sa fiche.
          </p>
        ) : (
          <div className="empty-state">
            <CheckIcon className="empty-state-icon" size={56} />
            <div className="empty-state-title">Aucun signalement</div>
          </div>
        )
      ) : (
        <div className="issue-list">
          {issues.map((issue) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className="issue-row">
              {issue.media.coverUrl ? (
                <CoverImage src={issue.media.coverUrl} alt="" className="issue-row-cover" width={44} height={66} />
              ) : (
                <div className="issue-row-cover admin-request-no-cover"><BookOpenIcon size={20} /></div>
              )}
              <div className="issue-row-info">
                <div className="issue-row-title">
                  {issue.media.title}
                  {issue.volume ? ` — ${issue.media.mediaType === "comic" ? "n°" : "tome "}${issue.volume}` : ""}
                </div>
                <div className="admin-request-meta" style={{ marginTop: 2 }}>
                  <span>{ISSUE_TYPE_LABELS[issue.type] ?? issue.type}</span>
                  {scope === "all" && <span>Par {issue.user.name}</span>}
                  <span>{formatDate(issue.createdAt)}</span>
                  {issue.commentCount > 0 && (
                    <span className="meta-with-icon"><ChatIcon size={15} /> {issue.commentCount}</span>
                  )}
                </div>
                <p className="issue-row-message">{issue.message}</p>
              </div>
              <span className={`status-badge ${issue.status === "open" ? "pending" : "available"}`}>
                {issue.status === "open" ? "Ouvert" : "Résolu"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
