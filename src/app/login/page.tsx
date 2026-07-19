import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Connexion — ReadSeerr" };

export default function LoginPage() {
  return (
    <div className="auth-page">
      <AuthForm mode="login" />
    </div>
  );
}
