"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  const userInitial = session?.user?.name?.charAt(0).toUpperCase() || "?";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <svg viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
            <path d="M8 8h4v16H8zM14 8h4v10h-4zM20 8h4v16h-4z" fill="white" opacity="0.9" />
          </svg>
          ReadSeerr
        </Link>

        {/* Nav Links */}
        <div className="navbar-links">
          {session ? (
            <>
              <Link href="/" className="navbar-link">Accueil</Link>
              <Link href="/requests" className="navbar-link">Mes demandes</Link>

              <div className="navbar-user">
                <div className="navbar-avatar">{userInitial}</div>
                <button
                  className="navbar-logout"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Déconnexion
                </button>
              </div>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: "8px 20px", fontSize: "0.9rem" }}>
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
