"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Account {
  name: string;
  email: string;
  ntfyTopic: string | null;
  ntfyServer: string;
}

/** Sujet difficile à deviner : sur ntfy.sh, quiconque connaît le sujet peut lire les messages. */
function randomTopic(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `readseerr-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data: Account) => {
        setAccount(data);
        setTopic(data.ntfyTopic ?? "");
      })
      .catch(() => setResult({ ok: false, message: "Impossible de charger votre compte." }));
  }, []);

  const save = async (value: string) => {
    setBusy("save");
    setResult(null);
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ntfyTopic: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccount((prev) => (prev ? { ...prev, ntfyTopic: data.ntfyTopic } : prev));
      setTopic(data.ntfyTopic ?? "");
      setResult({ ok: true, message: data.ntfyTopic ? "Sujet enregistré." : "Notifications push désactivées." });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error && err.message ? err.message : "Enregistrement impossible." });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setResult(null);
    try {
      const response = await fetch("/api/account/test-push", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult({ ok: true, message: "Notification de test envoyée : vérifiez votre téléphone." });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error && err.message ? err.message : "Envoi impossible." });
    } finally {
      setBusy(null);
    }
  };

  if (!account) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        {result ? <p className="form-error">{result.message}</p> : <LoadingSpinner size="lg" />}
      </div>
    );
  }

  const dirty = topic.trim() !== (account.ntfyTopic ?? "");
  const subscribeUrl = account.ntfyTopic ? `${account.ntfyServer}/${account.ntfyTopic}` : null;

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 760, paddingBottom: 60 }}>
        <div className="page-header">
          <h1 className="page-title">Mon compte</h1>
          <p className="page-subtitle">
            {account.name} · {account.email}
          </p>
        </div>

        <section className="settings-card">
          <h2 className="admin-section-title" style={{ marginBottom: 4 }}>
            Notifications push (ntfy)
          </h2>
          <p className="request-note" style={{ marginTop: 0, marginBottom: 16 }}>
            En plus des emails, recevez sur votre téléphone l&apos;avancement de vos demandes (acceptée, refusée,
            disponible), les nouveaux tomes de vos séries suivies et les réponses à vos signalements.
          </p>

          <ol className="account-steps">
            <li>
              Installez l&apos;application <strong>ntfy</strong> (Android, iPhone) ou ouvrez{" "}
              <a href={account.ntfyServer} target="_blank" rel="noopener noreferrer">
                {account.ntfyServer.replace(/^https?:\/\//, "")}
              </a>
              .
            </li>
            <li>Choisissez un sujet ci-dessous (ou générez-en un) et enregistrez-le.</li>
            <li>
              Dans ntfy, abonnez-vous à ce sujet{account.ntfyServer !== "https://ntfy.sh" && " sur le serveur indiqué"},
              puis envoyez une notification de test.
            </li>
          </ol>

          <div className="form-group">
            <label className="form-label" htmlFor="ntfy-topic">
              Sujet ntfy
            </label>
            <div className="account-topic-row">
              <input
                id="ntfy-topic"
                className="form-input"
                value={topic}
                maxLength={64}
                placeholder="readseerr-…"
                autoComplete="off"
                onChange={(e) => setTopic(e.target.value)}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTopic(randomTopic())}>
                Générer
              </button>
            </div>
            <span className="settings-help">
              Choisissez un sujet difficile à deviner : sur un serveur public, toute personne qui le connaît peut lire
              vos notifications.
            </span>
          </div>

          {subscribeUrl && (
            <p className="request-note">
              Abonnement : <code>{subscribeUrl}</code>
            </p>
          )}

          <div className="request-followup-actions">
            <button className="btn btn-primary btn-sm" onClick={() => save(topic)} disabled={!dirty || busy !== null}>
              {busy === "save" ? <LoadingSpinner /> : "Enregistrer"}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={test}
              disabled={!account.ntfyTopic || dirty || busy !== null}
            >
              {busy === "test" ? <LoadingSpinner /> : "Envoyer une notification de test"}
            </button>
            {account.ntfyTopic && (
              <button className="btn-link" onClick={() => save("")} disabled={busy !== null}>
                Désactiver
              </button>
            )}
          </div>
          {result && <p className={`settings-result ${result.ok ? "ok" : "ko"}`}>{result.message}</p>}
        </section>
      </div>
    </div>
  );
}
