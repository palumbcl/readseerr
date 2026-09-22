"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

interface AuthFormProps {
  ssoEnabled: boolean;
  callbackUrl: string;
  initialError?: string;
}

// Codes d'erreur renvoyés par Auth.js dans ?error=
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email ou mot de passe incorrect.",
  OAuthAccountNotLinked:
    "Un compte local existe déjà avec cet email. Connectez-vous avec votre mot de passe.",
  AccessDenied: "Accès refusé.",
  Configuration: "Erreur de configuration du serveur d'authentification.",
};

function errorMessage(code?: string) {
  if (!code) return "";
  return ERROR_MESSAGES[code] ?? "La connexion a échoué. Réessayez.";
}

export default function AuthForm({ ssoEnabled, callbackUrl, initialError }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorMessage(initialError));
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const router = useRouter();

  const handleSsoSignIn = () => {
    setSsoLoading(true);
    signIn("authelia", { callbackUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(errorMessage(result?.error ?? "CredentialsSignin"));
        setLoading(false);
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setLoading(false);
    }
  };

  const busy = loading || ssoLoading;

  return (
    <div className="auth-card">
      <div className="auth-sso-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="14" fill="url(#sso-grad)" />
          <defs>
            <linearGradient id="sso-grad" x1="0" y1="0" x2="48" y2="48">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path d="M8 8h4v16H8zM14 8h4v10h-4zM20 8h4v16h-4z" transform="translate(8 8)" fill="white" opacity="0.9" />
        </svg>
      </div>

      <h1 className="auth-title">ReadSeerr</h1>
      <p className="auth-subtitle">Connectez-vous pour accéder à l&apos;application</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 24 }}
          disabled={busy}
        >
          {loading ? (
            <>
              <LoadingSpinner /> Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </button>
      </form>

      <div className="auth-divider">
        <span>ou</span>
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sso"
        onClick={handleSsoSignIn}
        disabled={busy || !ssoEnabled}
        title={ssoEnabled ? undefined : "SSO non configuré sur ce serveur"}
      >
        {ssoLoading ? (
          <>
            <LoadingSpinner /> Redirection…
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Se connecter en SSO (Authelia)
          </>
        )}
      </button>

      {!ssoEnabled && (
        <p className="auth-footer">
          SSO indisponible : variables AUTHELIA_* non configurées sur ce serveur.
        </p>
      )}
    </div>
  );
}
