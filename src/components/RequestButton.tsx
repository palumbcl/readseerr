"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import VolumeSelector from "./VolumeSelector";
import { BookOpenIcon, CheckIcon, ClockIcon, DownloadIcon, PencilIcon, XIcon } from "./Icons";
import type { DetailAvailability, MediaDetail, QuotaStatus, RequestPayload } from "@/lib/types";

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
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  // Solde recalculé après chaque demande / modification
  const loadQuota = () => {
    fetch("/api/quota")
      .then((response) => (response.ok ? response.json() : null))
      .then(setQuota)
      .catch(() => setQuota(null));
  };
  useEffect(loadQuota, []);

  const quotaReached = quota?.remaining === 0;

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
        loadQuota();
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
      loadQuota();
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
      loadQuota();
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Impossible de modifier la demande.");
    }
    setStatus("success");
  };

  const libraryLink = state?.library?.url && (
    <a className="btn btn-secondary" href={state.library.url} target="_blank" rel="noopener noreferrer">
      <BookOpenIcon size={18} />
      Lire sur Komga
    </a>
  );

  // Tout est déjà dans la bibliothèque : rien à demander
  if (isFullyAvailable && !requestId && status === "idle") {
    return (
      <>
        <button className="btn btn-success" disabled>
          <CheckIcon size={18} strokeWidth={2.5} />
          Disponible
        </button>
        {libraryLink}
      </>
    );
  }

  const pendingOrApproved = requestStatus === "approved" ? "Demande acceptée" : "Demande envoyée";

  // Le composant rend une suite de boutons et de messages : le parent (.media-actions) aligne
  // les boutons sur une ligne et renvoie les messages (.action-note) en dessous
  return (
    <>
      {(status === "idle" || status === "selecting") && (
        <>
          <button className="btn btn-primary" onClick={handleClick} disabled={quotaReached}>
            <DownloadIcon size={18} />
            {isPartial ? "Demander les tomes manquants" : declined ? "Demander à nouveau" : "Demander"}
          </button>
          {isPartial && libraryLink}
          {quota && quota.limit !== null && (
            <p className={`action-note ${quotaReached ? "over-quota" : ""}`}>
              {quotaReached
                ? `Quota atteint (${quota.limit} tomes tous les ${quota.days} jours)${
                    quota.resetsAt
                      ? ` : de nouveaux tomes pourront être demandés à partir du ${new Date(quota.resetsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                      : ""
                  }.`
                : `Il vous reste ${quota.remaining} tome${(quota.remaining ?? 0) > 1 ? "s" : ""} à demander sur ${quota.days} jours (quota : ${quota.limit}).`}
            </p>
          )}
          {declined && (
            <p className="action-note">
              Votre précédente demande a été refusée
              {declined.declineReason ? <> : <strong>{declined.declineReason}</strong></> : "."}
            </p>
          )}
        </>
      )}

      {status === "loading" && (
        <button className="btn btn-primary" disabled>
          <LoadingSpinner />
          Envoi en cours…
        </button>
      )}

      {(status === "success" || status === "editing") && (
        <>
          <button className={`btn ${requestStatus === "approved" ? "btn-indigo-muted" : "btn-warning-muted"}`} disabled>
            {requestStatus === "approved" ? <CheckIcon size={18} strokeWidth={2.5} /> : <ClockIcon size={18} />}
            {pendingOrApproved}
          </button>
          {requestId && requestStatus === "pending" && (
            <>
              {media.volumes.length > 1 && (
                <button className="btn btn-secondary" onClick={() => setStatus("editing")}>
                  <PencilIcon size={18} />
                  Modifier
                </button>
              )}
              <button className="btn btn-secondary btn-danger-hover" onClick={cancelRequest}>
                <XIcon size={18} />
                Annuler
              </button>
            </>
          )}
          {requestStatus === "approved" && (
            <p className="action-note">L&apos;administrateur l&apos;a acceptée : elle sera bientôt ajoutée à la bibliothèque.</p>
          )}
          {actionError && <p className="action-note form-error">{actionError}</p>}
        </>
      )}

      {status === "error" && (
        <>
          <button className="btn btn-danger" onClick={() => setStatus("idle")}>
            <XIcon size={18} />
            Erreur — Réessayer
          </button>
          {errorMsg && <p className="action-note form-error">{errorMsg}</p>}
        </>
      )}

      {status === "selecting" && (
        <VolumeSelector
          volumes={media.volumes}
          ownedVolumes={ownedVolumes}
          maxSelectable={quota?.remaining ?? null}
          onConfirm={(selected) => submitRequest(selected)}
          onClose={() => setStatus("idle")}
        />
      )}

      {status === "editing" && (
        <VolumeSelector
          volumes={media.volumes}
          ownedVolumes={ownedVolumes}
          initialSelected={requestedVolumes}
          // Les tomes déjà demandés sont comptés dans le solde : ils restent sélectionnables
          maxSelectable={quota?.remaining != null ? quota.remaining + (requestedVolumes?.length || 1) : null}
          confirmLabel="Enregistrer"
          onConfirm={updateVolumes}
          onClose={() => setStatus("success")}
        />
      )}
    </>
  );
}
