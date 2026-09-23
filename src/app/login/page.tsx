import AuthForm from "@/components/AuthForm";
import { isSsoEnabled } from "@/lib/auth";
import { isKomgaLoginEnabled } from "@/lib/komga";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

// Dépend des paramètres (connexion Komga activée ou non) : jamais pré-rendue
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;

  // N'accepte que des chemins internes pour éviter les redirections ouvertes
  const safeCallbackUrl =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.startsWith("/login")
      ? callbackUrl
      : "/";

  return (
    <div className="auth-page">
      <AuthForm
        ssoEnabled={isSsoEnabled}
        komgaLoginEnabled={isKomgaLoginEnabled()}
        callbackUrl={safeCallbackUrl}
        initialError={error}
      />
    </div>
  );
}
