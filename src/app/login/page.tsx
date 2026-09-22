import AuthForm from "@/components/AuthForm";
import { isSsoEnabled } from "@/lib/auth";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;

  // N'accepte que des chemins internes pour éviter les redirections ouvertes
  const safeCallbackUrl =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.startsWith("/login")
      ? callbackUrl
      : "/";

  return (
    <div className="auth-page">
      <AuthForm ssoEnabled={isSsoEnabled} callbackUrl={safeCallbackUrl} initialError={error} />
    </div>
  );
}
