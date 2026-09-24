import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";
import { isRegistrationEnabled } from "@/lib/config";

// Dépend des paramètres (inscriptions ouvertes ou non) : jamais pré-rendue
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="auth-page">
      {isRegistrationEnabled() ? (
        <RegisterForm />
      ) : (
        <div className="auth-card">
          <h1 className="auth-title">Inscriptions fermées</h1>
          <p className="auth-subtitle">
            La création de compte est désactivée sur ce serveur. Demandez un accès à l&apos;administrateur.
          </p>
          <p className="auth-footer">
            <Link href="/login">Retour à la connexion</Link>
          </p>
        </div>
      )}
    </div>
  );
}
