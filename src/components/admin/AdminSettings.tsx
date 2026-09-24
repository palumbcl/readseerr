"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

type Source = "ui" | "env" | "none";
interface FieldState {
  value: string;
  source: Source;
  secret: boolean;
  set: boolean;
}
type ConfigState = Record<string, FieldState>;

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  type?: "text" | "number" | "toggle";
  /** Interrupteur : valeur appliquée quand rien n'est défini */
  defaultValue?: "true" | "false";
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  test?: "komga" | "discord" | "smtp" | "comicvine" | "prowlarr" | "push";
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "accounts",
    title: "Comptes",
    description: "Création de compte depuis la page de connexion. Les nouveaux comptes sont des lecteurs, soumis au quota.",
    fields: [
      {
        key: "registrationEnabled",
        label: "Inscriptions ouvertes",
        type: "toggle",
        defaultValue: "true",
        help: "Désactivé : seuls les comptes existants, Authelia et Komga (si activé) peuvent se connecter.",
      },
    ],
  },
  {
    id: "komga",
    title: "Komga",
    description: "Badges de disponibilité, synchronisation de la bibliothèque et clôture automatique des demandes.",
    test: "komga",
    fields: [
      { key: "komgaUrl", label: "URL (côté serveur)", placeholder: "http://komga:25600", help: "Adresse joignable par ReadSeerr (nom Docker possible)." },
      { key: "komgaPublicUrl", label: "URL publique", placeholder: "https://komga.exemple.fr", help: "Utilisée pour les liens ouverts dans le navigateur." },
      { key: "komgaApiKey", label: "Clé API", help: "Komga > Paramètres du compte > Clés API." },
      { key: "komgaUser", label: "Utilisateur (sans clé API)" },
      { key: "komgaPassword", label: "Mot de passe (sans clé API)" },
      { key: "komgaWebhookSecret", label: "Secret du webhook", help: "Jeton attendu par /api/webhooks/komga." },
      { key: "komgaSyncIntervalMinutes", label: "Intervalle de synchronisation (min)", placeholder: "30", type: "number" },
      {
        key: "komgaLoginEnabled",
        label: "Connexion avec un compte Komga",
        type: "toggle",
        help: "Les lecteurs se connectent avec leurs identifiants Komga ; leur compte ReadSeerr est créé à la première connexion.",
      },
    ],
  },
  {
    id: "discord",
    title: "Discord",
    description: "Notifications de l'administrateur : nouvelles demandes, signalements, disponibilités.",
    test: "discord",
    fields: [{ key: "discordWebhookUrl", label: "URL du webhook", placeholder: "https://discord.com/api/webhooks/…" }],
  },
  {
    id: "push",
    title: "Notifications push (ntfy / Gotify)",
    description:
      "Les alertes administrateur (demandes, signalements…) arrivent aussi sur votre téléphone. Les lecteurs choisissent leur propre sujet ntfy dans « Mon compte ».",
    test: "push",
    fields: [
      { key: "ntfyUrl", label: "Serveur ntfy", placeholder: "https://ntfy.sh", help: "Vide : ntfy.sh. Aussi utilisé pour les notifications des lecteurs." },
      { key: "ntfyAdminTopic", label: "Sujet ntfy administrateur", help: "Sujet difficile à deviner : sur un serveur public, il suffit de le connaître pour lire les messages." },
      { key: "ntfyToken", label: "Jeton d'accès ntfy (facultatif)", help: "Pour un serveur ntfy protégé." },
      { key: "gotifyUrl", label: "Serveur Gotify (facultatif)", placeholder: "https://gotify.exemple.fr" },
      { key: "gotifyToken", label: "Jeton d'application Gotify", help: "Gotify > Apps > Créer une application." },
    ],
  },
  {
    id: "smtp",
    title: "Emails (SMTP)",
    description: "Emails envoyés aux lecteurs. Le test envoie un email au compte expéditeur.",
    test: "smtp",
    fields: [
      { key: "smtpHost", label: "Serveur", placeholder: "smtp.gmail.com" },
      { key: "smtpPort", label: "Port", placeholder: "587", type: "number" },
      { key: "smtpUser", label: "Utilisateur / expéditeur", placeholder: "moi@exemple.fr" },
      { key: "smtpPass", label: "Mot de passe", help: "Pour Gmail : un mot de passe d'application." },
    ],
  },
  {
    id: "comicvine",
    title: "ComicVine",
    description: "Recherche des comics & BD, nouveautés et suivi des parutions.",
    test: "comicvine",
    fields: [{ key: "comicvineApiKey", label: "Clé API", help: "Gratuite sur comicvine.gamespot.com/api." }],
  },
  {
    id: "prowlarr",
    title: "Prowlarr",
    description: "Lien « Chercher sur Prowlarr » dans les notifications et la page d'administration.",
    test: "prowlarr",
    fields: [{ key: "prowlarrUrl", label: "URL (ouverte dans le navigateur)", placeholder: "https://prowlarr.exemple.fr" }],
  },
];

const SOURCE_LABELS: Record<Source, string> = {
  ui: "Interface",
  env: "Variable d'environnement",
  none: "Non défini",
};

/** Adresse à appeler depuis Komga (ou l'outil qui relaie ses événements) quand des tomes sont ajoutés. */
function WebhookUrlHint() {
  const [copied, setCopied] = useState(false);
  // Adresse vue par le navigateur : en production, celle de votre domaine
  const url = `${window.location.origin}/api/webhooks/komga?token=VOTRE_SECRET`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (HTTP non sécurisé) : l'adresse reste sélectionnable
    }
  };

  return (
    <div className="settings-webhook">
      <span className="settings-help">
        URL à appeler lors d&apos;un ajout dans Komga (remplacez <code>VOTRE_SECRET</code> par le secret ci-dessus) :
      </span>
      <div className="settings-webhook-url">
        <code>{url}</code>
        <button type="button" className="btn-link" onClick={copy}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </div>
  );
}

function SettingsSection({
  section,
  config,
  onSaved,
}: {
  section: SectionDef;
  config: ConfigState;
  onSaved: (config: ConfigState) => void;
}) {
  // Champs modifiés, envoyés tels quels ; null = retour à la variable d'environnement
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dirty = Object.keys(draft).length > 0;

  const send = async (patch: Record<string, string | null>) => {
    setBusy("save");
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSaved(data.config);
      setDraft({});
      setResult({ ok: true, message: "Enregistré." });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error && err.message ? err.message : "Enregistrement impossible." });
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    if (!section.test) return;
    setBusy("test");
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: section.test }),
      });
      const data = await response.json();
      setResult(response.ok ? data : { ok: false, message: data.error });
    } catch {
      setResult({ ok: false, message: "Test impossible (erreur réseau)." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="settings-card">
      <h3 className="admin-section-title" style={{ marginBottom: 4 }}>
        {section.title}
      </h3>
      <p className="request-note" style={{ marginTop: 0, marginBottom: 16 }}>
        {section.description}
      </p>

      <div className="settings-fields">
        {section.fields.map((field) => {
          const state = config[field.key];
          if (!state) return null;
          const inputValue = draft[field.key] ?? (state.secret ? "" : state.value);
          return (
            <div key={field.key} className="form-group">
              <label className="form-label" htmlFor={`cfg-${field.key}`}>
                {field.label}
                <span className={`settings-source ${state.source}`}>{SOURCE_LABELS[state.source]}</span>
              </label>
              {field.type === "toggle" ? (
                <select
                  id={`cfg-${field.key}`}
                  className="form-input"
                  value={(inputValue || field.defaultValue) === "true" ? "true" : "false"}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="false">Désactivée</option>
                  <option value="true">Activée</option>
                </select>
              ) : (
              <input
                id={`cfg-${field.key}`}
                className="form-input"
                type={state.secret ? "password" : field.type ?? "text"}
                autoComplete="off"
                value={inputValue}
                placeholder={state.secret ? (state.set ? "•••••••• (laisser vide pour conserver)" : "Non défini") : field.placeholder}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              )}
              {field.help && <span className="settings-help">{field.help}</span>}
              {field.key === "komgaWebhookSecret" && <WebhookUrlHint />}
              {state.source === "ui" && (
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: "0.75rem", marginTop: 4 }}
                  onClick={() => send({ [field.key]: null })}
                  disabled={busy !== null}
                >
                  Revenir à la variable d&apos;environnement
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="request-followup-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || busy !== null}
          // Un secret laissé vide n'est pas envoyé : la valeur actuelle est conservée
          onClick={() =>
            send(
              Object.fromEntries(
                Object.entries(draft).filter(([key, value]) => !(config[key]?.secret && value === ""))
              )
            )
          }
        >
          {busy === "save" ? <LoadingSpinner /> : "Enregistrer"}
        </button>
        {section.test && (
          <button className="btn btn-secondary btn-sm" onClick={runTest} disabled={busy !== null || dirty}>
            {busy === "test" ? <LoadingSpinner /> : "Tester la connexion"}
          </button>
        )}
        {dirty && <span className="settings-help">Enregistrez avant de tester.</span>}
      </div>
      {result && <p className={`settings-result ${result.ok ? "ok" : "ko"}`}>{result.ok ? "✓" : "✕"} {result.message}</p>}
    </section>
  );
}

export default function AdminSettings() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setConfig(data.config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les paramètres."));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!config) {
    return (
      <div className="loading-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="settings-grid">
      <p className="request-note" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
        Une valeur saisie ici remplace la variable d&apos;environnement correspondante, sans redémarrage. Les secrets ne
        sont jamais réaffichés. L&apos;authentification (NEXTAUTH, Authelia), <code>ADMIN_EMAILS</code> et la base de
        données restent configurées par variables d&apos;environnement.
      </p>
      {SECTIONS.map((section) => (
        <SettingsSection key={section.id} section={section} config={config} onSaved={setConfig} />
      ))}
    </div>
  );
}
