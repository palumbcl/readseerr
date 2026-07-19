import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Inscription — ReadSeerr" };

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <AuthForm mode="register" />
    </div>
  );
}
