"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function AuthForm() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);
    signIn("authelia", { callbackUrl: "/" });
  };

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
          <path
            d="M24 14a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z"
            fill="white"
            opacity="0.9"
          />
          <path
            d="M33 20h-2v-2a1 1 0 0 0-2 0v2h-2a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0v-2h2a1 1 0 0 0 0-2Z"
            fill="white"
            opacity="0.7"
          />
        </svg>
      </div>

      <h1 className="auth-title">ReadSeerr</h1>
      <p className="auth-subtitle">
        Connectez-vous via votre compte Authelia pour accéder à l&apos;application
      </p>

      <button
        type="button"
        className="btn btn-primary btn-sso"
        onClick={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <>
            <LoadingSpinner /> Redirection…
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Se connecter avec Authelia
          </>
        )}
      </button>

      <div className="auth-footer">
        Authentification sécurisée via SSO
      </div>
    </div>
  );
}
