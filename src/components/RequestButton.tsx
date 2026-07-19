"use client";

import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import VolumeSelector from "./VolumeSelector";
import type { MediaDetail, RequestPayload } from "@/lib/types";

interface RequestButtonProps {
  media: MediaDetail;
}

type RequestState = "idle" | "selecting" | "loading" | "success" | "error";

export default function RequestButton({ media }: RequestButtonProps) {
  const [state, setState] = useState<RequestState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = () => {
    if (media.volumes.length > 1) {
      setState("selecting");
    } else {
      submitRequest();
    }
  };

  const submitRequest = async (volumes?: number[]) => {
    setState("loading");
    setErrorMsg("");

    try {
      const payload: RequestPayload = {
        mediaType: media.type,
        externalId: media.id,
        title: media.title,
        coverUrl: media.coverUrl || undefined,
        volumes,
      };

      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setState("success");
      } else {
        setState("error");
        setErrorMsg(data.message || data.error || "Erreur inconnue");
      }
    } catch {
      setState("error");
      setErrorMsg("Erreur réseau. Vérifiez votre connexion.");
    }
  };

  const handleVolumeConfirm = (selectedVolumes: number[]) => {
    submitRequest(selectedVolumes);
  };

  return (
    <>
      {state === "idle" && (
        <button className="btn btn-primary btn-lg" onClick={handleClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Demander
        </button>
      )}

      {state === "loading" && (
        <button className="btn btn-primary btn-lg" disabled>
          <LoadingSpinner />
          Envoi en cours...
        </button>
      )}

      {state === "success" && (
        <button className="btn btn-success btn-lg" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Ajouté à la liste
        </button>
      )}

      {state === "error" && (
        <div>
          <button className="btn btn-error btn-lg" onClick={() => setState("idle")}>
            ✕ Erreur — Réessayer
          </button>
          {errorMsg && <p className="form-error" style={{ marginTop: 8 }}>{errorMsg}</p>}
        </div>
      )}

      {state === "selecting" && (
        <VolumeSelector
          volumes={media.volumes}
          onConfirm={handleVolumeConfirm}
          onClose={() => setState("idle")}
        />
      )}
    </>
  );
}
