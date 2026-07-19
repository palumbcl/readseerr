"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import RequestHistory from "@/components/RequestHistory";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="page-content">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Mes demandes</h1>
          <p className="page-subtitle">
            Historique de toutes vos demandes de lecture, {session.user?.name}.
          </p>
        </div>

        <RequestHistory />
      </div>
    </div>
  );
}
