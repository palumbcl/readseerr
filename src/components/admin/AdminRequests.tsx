"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { parseJsonArray } from "@/lib/titles";
import type { AdminRequestRecord, RequestStatus } from "@/lib/types";
import CoverImage from "@/components/CoverImage";

type Filter = RequestStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Acceptées" },
  { value: "available", label: "Disponibles" },
  { value: "declined", label: "Refusées" },
  { value: "all", label: "Toutes" },
];

const TYPE_LABELS: Record<string, string> = {
  manga: "🇯🇵 Manga",
  comic: "📘 Comic / BD",
  bd: "🇫🇷 BD", // anciennes demandes (source BD retirée)
};

type Action = "approve" | "decline" | "available" | "pending";

/** [1, 2, 3, 5, 7, 8] -> "1-3, 5, 7-8" */
function formatVolumes(raw: string | null): string {
  const volumes = parseJsonArray<number>(raw);
  if (!volumes || volumes.length === 0) return "Tous / non précisé";
  const ranges: string[] = [];
  let start = volumes[0];
  let prev = volumes[0];
  for (const n of [...volumes.slice(1), Infinity]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  return ranges.join(", ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminRequests() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [requests, setRequests] = useState<AdminRequestRecord[]>([]);
  const [counts, setCounts] = useState<Record<RequestStatus, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (status: Filter, pageNumber: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/requests?status=${status}&page=${pageNumber}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRequests(data.requests);
      setCounts(data.counts);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible de charger les demandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, page);
  }, [filter, page, load]);

  const changeFilter = (value: Filter) => {
    setFilter(value);
    setPage(1);
    setDecliningId(null);
  };

  const runAction = async (id: string, action: Action, reason?: string) => {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDecliningId(null);
      setDeclineReason("");
      // Recharge la liste : la demande change d'onglet et les compteurs bougent
      await load(filter, page);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="filter-chips">
        {FILTERS.map((f) => {
          const count = f.value === "all" ? allCount : counts?.[f.value];
          return (
            <button
              key={f.value}
              type="button"
              className={`filter-chip ${filter === f.value ? "active" : ""}`}
              onClick={() => changeFilter(f.value)}
            >
              {f.label}
              {count !== null && count !== undefined && <span className="filter-chip-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <div className="loading-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✨</div>
          <div className="empty-state-title">Rien à traiter</div>
          <p>Aucune demande dans cette catégorie.</p>
        </div>
      ) : (
        <div className="admin-request-list">
          {requests.map((req) => (
            <div key={req.id} className="admin-request-card">
              {req.coverUrl ? (
                <CoverImage className="admin-request-cover" src={req.coverUrl} alt="" width={64} height={96} />
              ) : (
                <div className="admin-request-cover admin-request-no-cover">📚</div>
              )}

              <div className="admin-request-info">
                <div className="admin-request-heading">
                  <Link href={`/details/${req.mediaType}/${encodeURIComponent(req.externalId)}`} className="admin-request-title">
                    {req.title}
                  </Link>
                  <StatusBadge status={req.status} />
                </div>

                <div className="admin-request-meta">
                  <span>{TYPE_LABELS[req.mediaType] ?? req.mediaType}</span>
                  <span>Tomes : {formatVolumes(req.volumes)}</span>
                  <span>
                    Par <strong>{req.user.name}</strong> le {formatDate(req.createdAt)}
                  </span>
                  {req.handledBy && req.handledAt && (
                    <span>
                      Traitée par {req.handledBy.name} le {formatDate(req.handledAt)}
                    </span>
                  )}
                </div>

                <div className="admin-request-meta">
                  {req.library ? (
                    <span className="admin-request-library">
                      📚 {req.library.booksCount} tome{req.library.booksCount > 1 ? "s" : ""} dans{" "}
                      {req.library.url ? (
                        <a href={req.library.url} target="_blank" rel="noopener noreferrer">{req.library.name}</a>
                      ) : (
                        req.library.name
                      )}
                    </span>
                  ) : (
                    <span>Absent de Komga</span>
                  )}
                  {req.otherRequests > 0 && (
                    <span className="admin-request-warning">
                      ⚠️ {req.otherRequests} autre{req.otherRequests > 1 ? "s" : ""} demande{req.otherRequests > 1 ? "s" : ""} en cours
                    </span>
                  )}
                  {req.prowlarrUrl && (
                    <a href={req.prowlarrUrl} target="_blank" rel="noopener noreferrer">🔎 Prowlarr</a>
                  )}
                  {req.sourceUrl && (
                    <a href={req.sourceUrl} target="_blank" rel="noopener noreferrer">Fiche source</a>
                  )}
                </div>

                {req.status === "declined" && req.declineReason && (
                  <p className="request-note">Motif : {req.declineReason}</p>
                )}

                {decliningId === req.id && (
                  <div className="admin-decline-form">
                    <input
                      className="form-input"
                      placeholder="Motif du refus (facultatif, envoyé au demandeur)"
                      value={declineReason}
                      maxLength={500}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-error btn-sm" onClick={() => runAction(req.id, "decline", declineReason)}>
                      Confirmer le refus
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDecliningId(null)}>
                      Annuler
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-request-actions">
                {busyId === req.id ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    {req.status === "pending" && (
                      <button className="btn btn-primary btn-sm" onClick={() => runAction(req.id, "approve")}>
                        Accepter
                      </button>
                    )}
                    {(req.status === "pending" || req.status === "approved") && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => runAction(req.id, "available")}>
                          Marquer disponible
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setDecliningId(req.id);
                            setDeclineReason("");
                          }}
                        >
                          Refuser
                        </button>
                      </>
                    )}
                    {req.status !== "pending" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => runAction(req.id, "pending")}>
                        Remettre en attente
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Précédent
          </button>
          <span>
            Page {page} / {pageCount}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
