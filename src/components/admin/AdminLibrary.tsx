"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface LibraryInfo {
  configured: boolean;
  running: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  seriesCount: number;
  lastFulfilled: number | null;
}

export default function AdminLibrary() {
  const [info, setInfo] = useState<LibraryInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const request = async (method: "GET" | "POST") => {
    setError("");
    try {
      const response = await fetch("/api/admin/library", { method });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible de joindre le serveur.");
    }
  };

  useEffect(() => {
    request("GET");
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    await request("POST");
    setSyncing(false);
  };

  if (!info) {
    return error ? (
      <p className="form-error">{error}</p>
    ) : (
      <div className="loading-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="admin-library-card">
      <h2 className="admin-section-title">Bibliothèque Komga</h2>

      {!info.configured ? (
        <p className="request-note">
          Komga n&apos;est pas configuré : renseignez son adresse et une clé API dans l&apos;onglet « Paramètres » pour
          afficher les badges de disponibilité et clore automatiquement les demandes.
        </p>
      ) : (
        <>
          <dl className="admin-library-stats">
            <div>
              <dt>Séries synchronisées</dt>
              <dd>{info.seriesCount.toLocaleString("fr-FR")}</dd>
            </div>
            <div>
              <dt>Dernière synchronisation</dt>
              <dd>
                {info.lastSyncAt
                  ? new Date(info.lastSyncAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
                  : "Jamais"}
              </dd>
            </div>
            {info.lastFulfilled !== null && (
              <div>
                <dt>Demandes closes au dernier passage</dt>
                <dd>{info.lastFulfilled}</dd>
              </div>
            )}
          </dl>

          {info.lastError && <p className="form-error">Dernière erreur : {info.lastError}</p>}

          <p className="request-note">
            La synchronisation tourne automatiquement (intervalle réglable dans « Paramètres », 30 min par défaut) et à
            chaque webhook Komga. Une demande passe en « disponible » quand tous ses tomes sont présents.
          </p>

          <button className="btn btn-primary" onClick={syncNow} disabled={syncing || info.running} style={{ marginTop: 16 }}>
            {syncing || info.running ? (
              <>
                <LoadingSpinner /> Synchronisation…
              </>
            ) : (
              "Synchroniser maintenant"
            )}
          </button>
          {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
        </>
      )}
    </div>
  );
}
