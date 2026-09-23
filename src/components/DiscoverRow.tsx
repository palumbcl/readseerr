"use client";

import { useRef } from "react";

interface DiscoverRowProps {
  title: string;
  subtitle?: string;
  /** Lien facultatif à droite du titre ("Voir dans Komga"…) */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Rangée défilante horizontalement, flèches sur ordinateur et glissement au doigt sur mobile. */
export default function DiscoverRow({ title, subtitle, action, children }: DiscoverRowProps) {
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
          {action}
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
