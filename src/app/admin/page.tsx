"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import AdminRequests from "@/components/admin/AdminRequests";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminLibrary from "@/components/admin/AdminLibrary";
import IssueList from "@/components/IssueList";
import LoadingSpinner from "@/components/LoadingSpinner";

type Tab = "requests" | "issues" | "users" | "library";

const TABS: { value: Tab; label: string }[] = [
  { value: "requests", label: "Demandes" },
  { value: "issues", label: "Signalements" },
  { value: "users", label: "Utilisateurs" },
  { value: "library", label: "Bibliothèque" },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("requests");

  if (status === "loading") {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Le rôle de la session ne sert qu'à l'affichage : chaque API revérifie les droits en base
  if (session?.user?.role !== "admin") {
    return (
      <div className="page-content">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <div className="empty-state-title">Accès réservé</div>
            <p>Cette page est réservée aux administrateurs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">Traitez les demandes et les signalements, gérez les comptes et la synchronisation Komga.</p>
        </div>

        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`admin-tab ${tab === t.value ? "active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "requests" && <AdminRequests />}
        {tab === "issues" && <IssueList scope="all" />}
        {tab === "users" && <AdminUsers />}
        {tab === "library" && <AdminLibrary />}
      </div>
    </div>
  );
}
