"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import { ClockIcon, CogIcon, LogoutIcon, SparklesIcon, UserIcon } from "@/components/Icons";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Découvrir", shortLabel: "Découvrir", icon: <SparklesIcon /> },
  { href: "/requests", label: "Mes demandes", shortLabel: "Demandes", icon: <ClockIcon /> },
  { href: "/admin", label: "Administration", shortLabel: "Admin", icon: <CogIcon />, adminOnly: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/discover");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo ${compact ? "logo-compact" : ""}`}>
      <svg viewBox="0 0 32 32" fill="none" className="logo-mark" aria-hidden>
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
        <path d="M8 8h4v16H8zM14 8h4v10h-4zM20 8h4v16h-4z" fill="white" opacity="0.9" />
      </svg>
      {!compact && <span className="logo-text">readseerr</span>}
    </span>
  );
}

/** Recherche de l'en-tête : reprend la requête en cours sur la page de résultats. */
function TopSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = pathname === "/search" ? params.get("q") ?? "" : "";
  return <SearchBar key={query} defaultQuery={query} compact />;
}

function UserMenu({ name, avatarInitial }: { name: string; avatarInitial: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
      >
        {avatarInitial}
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <span className="user-avatar user-avatar-sm">{avatarInitial}</span>
            <span className="user-menu-name">{name}</span>
          </div>
          <Link href="/account" className="user-menu-item" role="menuitem">
            <UserIcon size={18} />
            Mon compte
          </Link>
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogoutIcon size={18} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Structure de l'application connectée, calquée sur Seerr : barre latérale sur ordinateur,
 * barre de recherche en haut, barre d'onglets en bas sur mobile.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pas de navigation tant que l'utilisateur n'est pas connecté (connexion, inscription)
  if (!session) return <>{children}</>;

  const name = session.user?.name ?? "";
  const avatarInitial = name.charAt(0).toUpperCase() || "?";
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || session.user?.role === "admin");

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="sidebar-logo" aria-label="Accueil">
          <Logo />
        </Link>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(pathname, item.href) ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link href="/account" className="sidebar-account">
            <span className="user-avatar user-avatar-sm">{avatarInitial}</span>
            <span className="sidebar-account-text">
              <span className="sidebar-account-name">{name}</span>
              <span className="sidebar-account-sub">Mon compte</span>
            </span>
          </Link>
        </div>
      </aside>

      <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <Link href="/" className="topbar-logo" aria-label="Accueil">
          <Logo compact />
        </Link>
        <div className="topbar-search">
          <Suspense fallback={<SearchBar compact />}>
            <TopSearch />
          </Suspense>
        </div>
        <UserMenu name={name} avatarInitial={avatarInitial} />
      </header>

      <div className="app-main">{children}</div>

      <nav className="mobile-nav" aria-label="Navigation principale">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
          >
            {item.icon}
            <span>{item.shortLabel}</span>
          </Link>
        ))}
        <Link href="/account" className={`mobile-nav-link ${isActive(pathname, "/account") ? "active" : ""}`}>
          <UserIcon />
          <span>Compte</span>
        </Link>
      </nav>
    </div>
  );
}
