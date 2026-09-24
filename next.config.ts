import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Les couvertures ne changent quasiment jamais : versions redimensionnées gardées 30 jours
    minimumCacheTTL: 30 * 86_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s4.anilist.co",
        pathname: "/file/anilistcdn/**",
      },
      {
        protocol: "https",
        hostname: "comicvine.gamespot.com",
        pathname: "/a/uploads/**",
      },
    ],
  },
};

export default nextConfig;
