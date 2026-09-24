"use client";

import { useEffect } from "react";

/** Enregistre le service worker (page hors ligne, cache des fichiers statiques) en production. */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Service worker non enregistré :", error));
  }, []);
  return null;
}
