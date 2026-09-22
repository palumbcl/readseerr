import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Routes publiques
  // Seule la page de connexion est accessible sans session
  const publicRoutes = ["/login"];
  const publicApiRoutes = ["/api/auth", "/api/webhooks"];
  
  const isPublicRoute = 
    publicRoutes.includes(pathname) || 
    publicApiRoutes.some((route) => pathname.startsWith(route));

  // Static assets and Next.js internals
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico");

  // Si l'utilisateur est connecté et essaie d'aller sur /login, on le redirige vers l'accueil
  if (req.auth && publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isPublicRoute || isAsset) {
    return NextResponse.next();
  }

  // If not authenticated, redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

