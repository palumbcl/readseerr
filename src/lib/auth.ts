import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    {
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
    },
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      if (profile) {
        token.groups = (profile as Record<string, unknown>).groups ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});
