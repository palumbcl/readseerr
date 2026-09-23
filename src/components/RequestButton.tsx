"use client";

import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import VolumeSelector from "./VolumeSelector";
import type { DetailAvailability, MediaDetail, RequestPayload } from "@/lib/types";

interface RequestButtonProps {
  media: MediaDetail;
  /** État bibliothèque / demandes (null si inconnu) */
  state: DetailAvailability | null;
}

type RequestState = "idle" | "selecting" | "editing" | "loading" | "success" | "error";

export default function RequestButton({ media, state }: RequestButtonProps) {
  // Une demande déjà en cours s'affiche directement, avec ses actions
  const openRequest =
    state?.myRequest && (state.myRequest.status === "pending" || state.myRequest.status === "approved")
      ? state.myRequest
      : null;

  const [status, setStatus] = useState<RequestState>(openRequest ? "success" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [requestId, setRequestId] = useState<string | null>(openRequest?.id ?? null);
  const [requestStatus, setRequestStatus] = useState(openRequest?.status ?? "pending");
  const [requestedVolumes, setRequestedVolumes] = useState<number[] | undefined>(openRequest?.volumes ?? undefined);
  const [actionError, setActionError] = useState("");

  const ownedVolumes = state?.library?.volumes ?? null;
  const isFullyAvailable = state?.availability?.status === "available";
  const isPartial = state?.availability?.status === "partially_available";
  const declined = state?.myRequest?.status === "declined" ? state.myRequest : null;

  const handleClick = () => {
    if (media.volumes.length > 1) {
      setStatus("selecting");
    } else {
      submitRequest();
    }
  };

  const submitRequest = async (volumes?: number[]) => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const payload: RequestPayload = {
        mediaType: media.type,
        externalId: media.id,
        title: media.title,
        coverUrl: media.coverUrl || undefined,
        volumes,
        altTitles: media.altTitles,
        volumeCount: media.volumes.length || media.volumeCount || null,
        year: media.year,
        publisher: media.publisher,
        author: media.author,
      };

      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setRequestId(data.requestId);
        setRequestStatus("pending");
        setRequestedVolumes(volumes);
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.message || data.error || "Erreur inconnue");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Erreur réseau. Vérifiez votre connexion.");
    }
  };

  // Annulation immédiate après un mauvais clic
  const cancelRequest = async () => {
    if (!requestId) return;
    setStatus("loading");
    setActionError("");

    try {
      const response = await fetch(`/api/request/${requestId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRequestId(null);
      setRequestedVolumes(undefined);
      setStatus("idle");
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible d'annuler la demande.");
      setStatus("success");
    }
  };

  const updateVolumes = async (selectedVolumes: number[]) => {
    if (!requestId) return;
    setStatus("loading");
    setActionError("");

    try {
      const response = await fetch(`/api/request/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumes: selectedVolumes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRequestedVolumes(selectedVolumes);
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible de modifier la demande.");
    }
    setStatus("success");
  };

  const libraryLink = state?.library?.url && (
    <a className="btn btn-secondary btn-lg" href={state.library.url} target="_blank" rel="noopener noreferrer">
      Ouvrir dans Komga
    </a>
  );

  // Tout est déjà dans la bibliothèque : rien à demander
  if (isFullyAvailable && !requestId && status === "idle") {
    return (
      <div className="request-followup-actions" style={{ marginTop: 0 }}>
        <button className="btn btn-success btn-lg" disabled>
          ● Disponible
        </button>
        {libraryLink}
      </div>
    );
  }

  const pendingOrApproved = requestStatus === "approved" ? "Demande acceptée" : "Demande envoyée";

  return (
    <>
      {status === "idle" && (
        <div>
          <div className="request-followup-actions" style={{ marginTop: 0 }}>
            <button className="btn btn-primary btn-lg" onClick={handleClick}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isPartial ? "Demander les tomes manquants" : declined ? "Demander à nouveau" : "Demander"}
            </button>
            {isPartial && libraryLink}
          </div>
          {declined && (
            <p className="request-note">
              Votre précédente demande a été refusée
              {declined.declineReason ? <> : <strong>{declined.declineReason}</strong></> : "."}
            </p>
          )}
        </div>
      )}

      {status === "loading" && (
        <button className="btn btn-primary btn-lg" disabled>
          <LoadingSpinner />
          Envoi en cours...
        </button>
      )}

      {status === "success" && (
        <div>
          <button className="btn btn-success btn-lg" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {pendingOrApproved}
          </button>
          {requestStatus === "approved" && (
            <p className="request-note">L&apos;administrateur l&apos;a acceptée : elle sera bientôt ajoutée à la bibliothèque.</p>
          )}
          {requestId && requestStatus === "pending" && (
            <div className="request-followup-actions">
              {media.volumes.length > 1 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setStatus("editing")}>
                  Modifier les tomes
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={cancelRequest}>
                Annuler la demande
              </button>
            </div>
          )}
          {actionError && <p className="form-error" style={{ marginTop: 8 }}>{actionError}</p>}
        </div>
      )}

      {status === "error" && (
        <div>
          <button className="btn btn-error btn-lg" onClick={() => setStatus("idle")}>
            ✕ Erreur — Réessayer
          </button>
          {errorMsg && <p className="form-error" style={{ marginTop: 8 }}>{errorMsg}</p>}
        </div>
      )}

      {status === "selecting" && (
        <VolumeSelector
          volumes={media.volumes}
          ownedVolumes={ownedVolumes}
          onConfirm={(selected) => submitRequest(selected)}
          onClose={() => setStatus("idle")}
        />
      )}

      {status === "editing" && (
        <VolumeSelector
          volumes={media.volumes}
          ownedVolumes={ownedVolumes}
          initialSelected={requestedVolumes}
          confirmLabel="Enregistrer"
          onConfirm={updateVolumes}
          onClose={() => setStatus("success")}
        />
      )}
    </>
  );
}
