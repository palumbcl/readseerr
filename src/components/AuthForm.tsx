"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "./LoadingSpinner";

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Les mots de passe ne correspondent pas.");
          setLoading(false);
          return;
        }

        // Register
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erreur lors de l'inscription.");
          setLoading(false);
          return;
        }

        // Auto-login after registration
        const loginResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (loginResult?.error) {
          setError("Compte créé, mais erreur de connexion. Essayez de vous connecter.");
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        // Login
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Email ou mot de passe incorrect.");
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-title">
        {mode === "login" ? "Connexion" : "Inscription"}
      </h1>
      <p className="auth-subtitle">
        {mode === "login"
          ? "Connectez-vous pour gérer vos demandes"
          : "Créez un compte pour commencer"}
      </p>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <div className="form-group">
            <label className="form-label" htmlFor="name">Nom</label>
            <input
              id="name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
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
            minLength={8}
            required
          />
        </div>

        {mode === "register" && (
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 24 }}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingSpinner /> Chargement...
            </>
          ) : mode === "login" ? (
            "Se connecter"
          ) : (
            "Créer un compte"
          )}
        </button>
      </form>

      <div className="auth-footer">
        {mode === "login" ? (
          <>
            Pas encore de compte ?{" "}
            <a href="/register">Créer un compte</a>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <a href="/login">Se connecter</a>
          </>
        )}
      </div>
    </div>
  );
}
