"use client";

import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import LoadingSpinner from "./LoadingSpinner";
import VolumeSelector from "./VolumeSelector";
import { parseJsonArray } from "@/lib/titles";
import type { DetailAvailability, MediaDetail, RequestRecord } from "@/lib/types";
import CoverImage from "@/components/CoverImage";

/** Une demande déjà traitée par l'admin (acceptée, refusée, disponible) ne peut plus être modifiée. */
const EDITABLE_STATUSES = new Set(["pending"]);

type StatusFilter = "all" | "pending" | "approved" | "available" | "declined";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Acceptées" },
  { value: "available", label: "Disponibles" },
  { value: "declined", label: "Refusées" },
];

export default function RequestHistory() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    request: RequestRecord;
    detail: MediaDetail;
    ownedVolumes: number[] | null;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  // Recherche appliquée après une courte pause de frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "all") params.set("status", status);
      if (query) params.set("q", query);
      const response = await fetch(`/api/request?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? 25);
        setCounts(data.counts ?? null);
      }
    } catch {
      console.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  }, [page, status, query]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const removeRequest = async (id: string) => {
    setBusyId(id);
    setActionError("");

    try {
      const response = await fetch(`/api/request/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      // Recharge la page : une demande de la page suivante remonte, les compteurs bougent
      await fetchRequests();
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible de retirer la demande.");
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  };

  // Charge la liste des tomes de l'œuvre avant d'ouvrir le sélecteur
  const startEditing = async (req: RequestRecord) => {
    setBusyId(req.id);
    setActionError("");

    try {
      const response = await fetch(
        `/api/details?type=${req.mediaType}&id=${encodeURIComponent(req.externalId)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const detail: MediaDetail = data.detail;
      const state: DetailAvailability | null = data.state ?? null;
      if (detail.volumes.length <= 1) {
        throw new Error("Cette œuvre n'a pas de tomes à sélectionner.");
      }
      setEditing({ request: req, detail, ownedVolumes: state?.library?.volumes ?? null });
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible de charger les tomes.");
    } finally {
      setBusyId(null);
    }
  };

  const saveVolumes = async (volumes: number[]) => {
    if (!editing) return;
    const id = editing.request.id;
    setEditing(null);
    setBusyId(id);
    setActionError("");

    try {
      const response = await fetch(`/api/request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, volumes: data.request.volumes, status: data.request.status } : req))
      );
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible de modifier la demande.");
    } finally {
      setBusyId(null);
    }
  };

  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtering = status !== "all" || query !== "";

  // Aucune demande du tout : message d'accueil plutôt que filtres vides
  if (!loading && allCount === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">Aucune demande</div>
        <p>Vous n&apos;avez pas encore fait de demande. Recherchez un manga, comic ou BD pour commencer !</p>
      </div>
    );
  }

  const toolbar = (
    <div className="history-toolbar">
      <div className="filter-chips" style={{ padding: 0 }}>
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "all" ? allCount : counts?.[f.value];
          return (
            <button
              key={f.value}
              type="button"
              className={`filter-chip ${status === f.value ? "active" : ""}`}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
            >
              {f.label}
              {count !== null && count !== undefined && <span className="filter-chip-count">{count}</span>}
            </button>
          );
        })}
      </div>
      <input
        type="search"
        className="form-input history-search"
        placeholder="Rechercher un titre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Rechercher dans l'historique"
      />
    </div>
  );

  const pagination = pageCount > 1 && (
    <div className="admin-pagination" style={{ paddingTop: 16 }}>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
        ← Précédent
      </button>
      <span>
        Page {page} / {pageCount} · {total} demande{total > 1 ? "s" : ""}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={page >= pageCount || loading}
        onClick={() => setPage((p) => p + 1)}
      >
        Suivant →
      </button>
    </div>
  );

  if (loading && requests.length === 0) {
    return (
      <>
        {counts && toolbar}
        <div className="loading-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  if (requests.length === 0) {
    return (
      <>
        {toolbar}
        <p className="request-note" style={{ textAlign: "center", padding: "32px 0" }}>
          {filtering ? "Aucune demande ne correspond à ces filtres." : "Aucune demande."}
        </p>
      </>
    );
  }

  // La colonne Actions n'a de sens que si au moins une demande est encore modifiable
  const hasEditableRequest = requests.some((req) => EDITABLE_STATUSES.has(req.status));

  const typeLabels: Record<string, string> = {
    manga: "🇯🇵 Manga",
    comic: "📘 Comic / BD",
    bd: "🇫🇷 BD", // anciennes demandes (source BD retirée)
  };

  return (
    <>
    {toolbar}
    {actionError && <p className="form-error" style={{ marginBottom: 12 }}>{actionError}</p>}
    <div className="requests-table-wrapper" style={{ opacity: loading ? 0.6 : 1 }}>
      <table className="requests-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Type</th>
            <th>Tomes</th>
            <th>Statut</th>
            <th>Date</th>
            {hasEditableRequest && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>
                <div className="request-title-cell">
                  {req.coverUrl && (
                    <CoverImage className="request-cover-thumb" src={req.coverUrl} alt="" width={40} height={56} />
                  )}
                  <span>{req.title}</span>
                </div>
              </td>
              <td>{typeLabels[req.mediaType] || req.mediaType}</td>
              <td>{parseJsonArray<number>(req.volumes)?.join(", ") ?? "Tous"}</td>
              <td>
                <StatusBadge status={req.status} />
                {req.status === "declined" && req.declineReason && (
                  <div className="request-note" style={{ marginTop: 6 }}>{req.declineReason}</div>
                )}
              </td>
              <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {new Date(req.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              {hasEditableRequest && (
              <td>
                {EDITABLE_STATUSES.has(req.status) ? (
                  <div className="request-row-actions">
                    {busyId === req.id ? (
                      <LoadingSpinner />
                    ) : confirmingId === req.id ? (
                      <>
                        <button className="btn btn-error btn-sm" onClick={() => removeRequest(req.id)}>
                          Confirmer
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(null)}>
                          Non
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditing(req)}
                          disabled={!req.volumes}
                          title={req.volumes ? undefined : "Aucun tome à choisir pour cette œuvre."}
                        >
                          Modifier
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConfirmingId(req.id)}>
                          Retirer
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    className="request-row-actions"
                    title="Demande déjà traitée : elle ne peut plus être modifiée ni retirée."
                  >
                    <button className="btn btn-secondary btn-sm" disabled>
                      Modifier
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled>
                      Retirer
                    </button>
                  </div>
                )}
              </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {pagination}

    {editing && (
      <VolumeSelector
        volumes={editing.detail.volumes}
        initialSelected={parseJsonArray<number>(editing.request.volumes) ?? undefined}
        ownedVolumes={editing.ownedVolumes}
        confirmLabel="Enregistrer"
        onConfirm={saveVolumes}
        onClose={() => setEditing(null)}
      />
    )}
    </>
  );
}
