"use client";

import { useRef } from "react";
import Link from "next/link";

interface DiscoverRowProps {
  title: string;
  subtitle?: string;
  /** Page « Voir tout » de la rangée */
  href?: string;
  children: React.ReactNode;
}

/** Rangée défilante horizontalement, flèches sur ordinateur et glissement au doigt sur mobile. */
export default function DiscoverRow({ title, subtitle, href, children }: DiscoverRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="discover-row">
      <div className="discover-row-header">
        <div>
          <h2 className="discover-row-title">{title}</h2>
          {subtitle && <p className="discover-row-subtitle">{subtitle}</p>}
        </div>
        <div className="discover-row-controls">
          {href && (
            <Link href={href} className="discover-row-see-all">
              Voir tout
            </Link>
          )}
          <button type="button" className="discover-row-arrow" onClick={() => scrollBy(-1)} aria-label="Précédent">
            ‹
          </button>
          <button type="button" className="discover-row-arrow" onClick={() => scrollBy(1)} aria-label="Suivant">
            ›
          </button>
        </div>
      </div>
      <div className="discover-row-track" ref={trackRef}>
        {children}
      </div>
    </section>
  );
}
