"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Hôtes des couvertures redimensionnées par Next.js (voir `images.remotePatterns` dans next.config.ts).
 * Les autres images (couvertures Komga servies par ReadSeerr, hôtes inconnus) sont affichées telles quelles.
 */
const OPTIMIZED_HOSTS = ["s4.anilist.co", "comicvine.gamespot.com"];

function isOptimizable(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZED_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

type CoverImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Chargement immédiat (images visibles dès l'arrivée sur la page) */
  priority?: boolean;
} & (
  | {
      /** Remplit le conteneur parent (qui doit être en position relative) */
      fill: true;
      /** Largeur d'affichage, pour choisir la taille servie (ex. "(max-width: 600px) 45vw, 180px") */
      sizes: string;
    }
  | {
      fill?: false;
      /** Dimensions d'affichage en pixels CSS (la taille servie est doublée pour les écrans haute densité) */
      width: number;
      height: number;
    }
);

/**
 * Couverture optimisée : redimensionnée à la taille affichée et convertie en WebP par le serveur,
 * chargée au dernier moment. Masquée si l'image est introuvable, pour laisser voir le fond du conteneur.
 */
export default function CoverImage(props: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const common = {
    src: props.src,
    alt: props.alt,
    className: props.className,
    priority: props.priority,
    unoptimized: !isOptimizable(props.src),
    onError: () => setFailed(true),
  };

  return props.fill ? (
    <Image {...common} fill sizes={props.sizes} />
  ) : (
    // Sans `sizes` : Next.js sert l'image en 1x et 2x de ces dimensions
    <Image {...common} width={props.width} height={props.height} />
  );
}
