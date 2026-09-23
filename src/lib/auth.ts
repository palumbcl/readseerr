import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcrypt-ts";
import { resolveRole } from "@/lib/roles";
import { authenticateKomgaUser, isKomgaLoginEnabled } from "@/lib/komga";

/** Un compte ReadSeerr existe déjà avec cet email, sans lien avec Komga. */
class KomgaAccountConflict extends CredentialsSignin {
  code = "komga_conflict";
}

class KomgaUnavailable extends CredentialsSignin {
  code = "komga_unavailable";
}

/**
 * Connexion avec un compte Komga : le compte ReadSeerr est créé et lié à la première connexion.
 * Un compte Komga ne peut jamais reprendre un compte ReadSeerr existant (local ou Authelia)
 * portant le même email : sinon, créer un compte Komga "admin@readseerr.local" suffirait à devenir admin.
 */
async function authorizeKomgaUser(email: string, password: string) {
  const komga = await authenticateKomgaUser(email, password);
  if (komga === "unavailable") throw new KomgaUnavailable();
  if (!komga) return null;

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "komga", providerAccountId: komga.id } },
    include: { user: true },
  });
  if (linked) return { id: linked.user.id, name: linked.user.name, email: linked.user.email };

  if (await prisma.user.findUnique({ where: { email: komga.email } })) throw new KomgaAccountConflict();

  const created = await prisma.user.create({
    data: {
      name: komga.email.split("@")[0],
      email: komga.email,
      accounts: { create: { type: "credentials", provider: "komga", providerAccountId: komga.id } },
    },
  });
  console.log(`Nouveau compte ReadSeerr créé depuis Komga : ${komga.email}`);
  return { id: created.id, name: created.name, email: created.email };
}

// Le SSO n'est activé que si Authelia est entièrement configuré : un provider
// OIDC incomplet invalide toute la config Auth.js (y compris la connexion locale).
export const isSsoEnabled = Boolean(
  process.env.AUTHELIA_ISSUER_URL &&
    process.env.AUTHELIA_CLIENT_ID &&
    process.env.AUTHELIA_CLIENT_SECRET
);

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    name: "Compte local",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
      const password = credentials?.password as string | undefined;

      if (!email || !password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      // 1. Compte local ReadSeerr (les comptes Authelia / Komga n'ont pas de mot de passe local)
      if (user?.passwordHash && (await compare(password, user.passwordHash))) {
        return { id: user.id, name: user.name, email: user.email };
      }

      // 2. Identifiants Komga, si l'option est activée dans les paramètres
      if (!isKomgaLoginEnabled()) return null;
      return authorizeKomgaUser(email, password);
    },
  }),
];

if (isSsoEnabled) {
  providers.push({
    id: "authelia",
    name: "Authelia",
    type: "oidc",
    issuer: process.env.AUTHELIA_ISSUER_URL,
    clientId: process.env.AUTHELIA_CLIENT_ID,
    clientSecret: process.env.AUTHELIA_CLIENT_SECRET,
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    authorization: {
      params: {
        scope: "openid profile email groups",
      },
    },
    checks: ["pkce", "state"],
    profile(profile) {
      const name =
        profile.preferred_username ||
        profile.name ||
        (typeof profile.email === "string"
          ? profile.email.split("@")[0]
          : undefined) ||
        profile.sub;

      const email =
        profile.email ||
        `${profile.sub}@authelia.local`;

      return {
        id: profile.sub,
        name,
        email,
        image: profile.picture ?? null,
      };
    },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, profile }) {
      if (profile) {
        token.groups = (profile as Record<string, unknown>).groups ?? [];
      }
      if (user?.id) {
        token.id = user.id;
        token.name = user.name;

        // Connexion : rôle effectif (ADMIN_EMAILS / groupe Authelia / base), recopié en base.
        // Le rôle du jeton ne sert qu'à l'affichage : les API recalculent toujours le rôle.
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, email: true } });
        const role = resolveRole(dbUser?.role, dbUser?.email, token.groups);
        if (dbUser && dbUser.role !== role) {
          await prisma.user.update({ where: { id: user.id }, data: { role } });
        }
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.role = token.role === "admin" ? "admin" : "user";
      }
      return session;
    },
  },
});
