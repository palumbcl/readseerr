"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { QuotaSettings } from "@/lib/types";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  /** null = quota par défaut, -1 = illimité */
  quotaLimit: number | null;
  createdAt: string;
  providers: string[];
  requestCount: number;
  openRequestCount: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  local: "Compte local",
  authelia: "Authelia",
};

/** Quota par défaut : tomes tous les N jours (vide = illimité). */
function QuotaDefaults() {
  const [quota, setQuota] = useState<QuotaSettings | null>(null);
  const [limit, setLimit] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setQuota(data.quota);
        setLimit(data.quota.limit ? String(data.quota.limit) : "");
        setDays(String(data.quota.days));
      })
      .catch(() => setMessage({ ok: false, text: "Impossible de charger le quota." }));
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quota: { limit: limit ? parseInt(limit, 10) : null, days: parseInt(days, 10) } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQuota(data.quota);
      setMessage({ ok: true, text: "Quota enregistré." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error && err.message ? err.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  };

  if (!quota) return null;

  return (
    <div className="quota-settings">
      <div className="form-group">
        <label className="form-label" htmlFor="quota-limit">Quota par défaut (tomes)</label>
        <input
          id="quota-limit"
          className="form-input"
          type="number"
          min={1}
          placeholder="Illimité"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="quota-days">Période (jours)</label>
        <input
          id="quota-days"
          className="form-input"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </div>
      <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !days}>
        {busy ? <LoadingSpinner /> : "Enregistrer"}
      </button>
      <p className="request-note" style={{ flexBasis: "100%", margin: 0 }}>
        {message ? (
          <span className={message.ok ? "" : "over-quota"}>{message.text}</span>
        ) : quota.limit ? (
          `Chaque lecteur peut demander ${quota.limit} tomes tous les ${quota.days} jours (demandes refusées exclues). Les admins ne sont pas limités.`
        ) : (
          "Aucun quota : laissez vide pour ne pas limiter les demandes."
        )}
      </p>
    </div>
  );
}

/** Quota d'un lecteur : défaut, illimité ou valeur personnalisée. */
function QuotaCell({ user, onSave }: { user: AdminUser; onSave: (quotaLimit: number | null) => void }) {
  const mode = user.quotaLimit === null ? "default" : user.quotaLimit === -1 ? "unlimited" : "custom";
  const [custom, setCustom] = useState(user.quotaLimit && user.quotaLimit > 0 ? String(user.quotaLimit) : "10");

  return (
    <div className="quota-cell">
      <select
        className="form-input"
        value={mode}
        onChange={(e) => {
          const value = e.target.value;
          onSave(value === "default" ? null : value === "unlimited" ? -1 : parseInt(custom, 10) || 10);
        }}
      >
        <option value="default">Par défaut</option>
        <option value="unlimited">Illimité</option>
        <option value="custom">Personnalisé</option>
      </select>
      {mode === "custom" && (
        <input
          className="form-input"
          type="number"
          min={1}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => parseInt(custom, 10) > 0 && parseInt(custom, 10) !== user.quotaLimit && onSave(parseInt(custom, 10))}
          aria-label="Nombre de tomes"
        />
      )}
    </div>
  );
}

export default function AdminUsers() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rolesManagedByEnv, setRolesManagedByEnv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/admin/users");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setUsers(data.users);
        setRolesManagedByEnv(Boolean(data.rolesManagedByEnv));
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Impossible de charger les utilisateurs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateUser = async (user: AdminUser, patch: Partial<Pick<AdminUser, "role" | "quotaLimit">>) => {
    setBusyId(user.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible de modifier l'utilisateur.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <QuotaDefaults />

      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      {rolesManagedByEnv && (
        <p className="request-note" style={{ marginBottom: 12 }}>
          Les administrateurs sont définis par la variable <code>ADMIN_EMAILS</code> : modifiez-la (puis redémarrez)
          pour changer les rôles.
        </p>
      )}
      <div className="requests-table-wrapper">
        <table className="requests-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Connexion</th>
              <th>Demandes</th>
              <th>Quota</th>
              <th>Inscrit le</th>
              <th>Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{user.email}</div>
                </td>
                <td>{user.providers.map((p) => PROVIDER_LABELS[p] ?? p).join(", ") || "—"}</td>
                <td>
                  {user.requestCount}
                  {user.openRequestCount > 0 && (
                    <span style={{ color: "var(--text-secondary)" }}> ({user.openRequestCount} en cours)</span>
                  )}
                </td>
                <td>
                  {user.role === "admin" ? (
                    <span style={{ color: "var(--text-secondary)" }}>Illimité (admin)</span>
                  ) : (
                    <QuotaCell user={user} onSave={(quotaLimit) => updateUser(user, { quotaLimit })} />
                  )}
                </td>
                <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td>
                  <div className="request-row-actions">
                    <span className={`role-badge ${user.role}`}>{user.role === "admin" ? "Admin" : "Lecteur"}</span>
                    {busyId === user.id ? (
                      <LoadingSpinner />
                    ) : rolesManagedByEnv ? null : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateUser(user, { role: user.role === "admin" ? "user" : "admin" })}
                        disabled={user.id === session?.user?.id}
                        title={user.id === session?.user?.id ? "Vous ne pouvez pas modifier votre propre rôle." : undefined}
                      >
                        {user.role === "admin" ? "Retirer admin" : "Passer admin"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
