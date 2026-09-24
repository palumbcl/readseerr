import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import AppShell from "@/components/AppShell";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#111827",
  // Contenu sous l'encoche / la barre d'état des téléphones, en mode application
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ReadSeerr",
  description: "Interface unifiée pour demander des mangas, comics et BD, synchronisée avec Komga.",
  // Le manifeste (src/app/manifest.ts) est ajouté automatiquement par Next.js
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    // iOS ignore le manifeste : l'icône de l'écran d'accueil vient d'ici
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ReadSeerr",
  },
  openGraph: {
    title: "ReadSeerr",
    description: "Demandez vos mangas, comics et BD en un clic.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
