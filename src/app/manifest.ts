import type { MetadataRoute } from "next";

/** Manifeste PWA, servi à /manifest.webmanifest (accessible sans connexion : le navigateur l'obtient sans cookie). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ReadSeerr",
    short_name: "ReadSeerr",
    description: "Recherchez et demandez vos mangas, comics et BD.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111827",
    theme_color: "#111827",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes demandes", url: "/requests", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
