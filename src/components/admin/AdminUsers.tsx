"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  providers: string[];
  requestCount: number;
  openRequestCount: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  local: "Compte local",
  authelia: "Authelia",
};

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

  const toggleRole = async (user: AdminUser) => {
    const role = user.role === "admin" ? "user" : "admin";
    setBusyId(user.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Impossible de modifier le rôle.");
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
                        onClick={() => toggleRole(user)}
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
