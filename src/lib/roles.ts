export type Role = "user" | "admin";

/** Emails listés dans ADMIN_EMAILS (séparés par des virgules), en minuscules. */
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Quand ADMIN_EMAILS est défini, il fait foi : les rôles ne se gèrent plus depuis l'interface. */
export function areRolesManagedByEnv(): boolean {
  return getAdminEmails().length > 0;
}

/**
 * Rôle effectif d'un compte.
 * - ADMIN_EMAILS défini : admin si et seulement si l'email y figure.
 * - Sinon : rôle stocké en base, ou admin via le groupe Authelia AUTHELIA_ADMIN_GROUP (à la connexion).
 */
export function resolveRole(storedRole: string | null | undefined, email: string | null | undefined, groups?: unknown): Role {
  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0) {
    return email && adminEmails.includes(email.toLowerCase()) ? "admin" : "user";
  }

  const adminGroup = process.env.AUTHELIA_ADMIN_GROUP;
  if (adminGroup && Array.isArray(groups) && groups.includes(adminGroup)) return "admin";
  return storedRole === "admin" ? "admin" : "user";
}
