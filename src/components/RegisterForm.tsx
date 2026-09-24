"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

/** Création d'un compte lecteur, puis connexion automatique. */
export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        // Compte créé mais connexion impossible : l'utilisateur se connecte à la main
        router.replace("/login");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Erreur réseau. Vérifiez votre connexion.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-title">Créer un compte</h1>
      <p className="auth-subtitle">Rejoignez ReadSeerr pour demander vos lectures</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="name">Nom</label>
          <input
            id="name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre prénom ou pseudo"
            autoComplete="nickname"
            minLength={2}
            maxLength={50}
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            autoComplete="email"
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
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm">Confirmer le mot de passe</label>
          <input
            id="confirm"
            type="password"
            className="form-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 24 }} disabled={loading}>
          {loading ? (
            <>
              <LoadingSpinner /> Création…
            </>
          ) : (
            "Créer mon compte"
          )}
        </button>
      </form>

      <p className="auth-footer">
        Déjà un compte ? <Link href="/login">Se connecter</Link>
      </p>
    </div>
  );
}
