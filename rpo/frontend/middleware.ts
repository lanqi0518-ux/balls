import { NextRequest, NextResponse } from "next/server";

/**
 * Geo-blocking middleware for Reg-S compliance.
 *
 * Robinhood Assets (Jersey) Reg-S Stock Tokens are NOT offered or sold to
 * persons in the following jurisdictions. This middleware runs at the
 * edge (before any page renders) and redirects blocked visitors to a
 * friendly explanation page.
 *
 * Country signal is preferred in this order (fastest & most reliable first):
 *   1. `cf-ipcountry`           — set by Cloudflare when the origin is
 *                                 fronted by Cloudflare (recommended).
 *   2. `x-vercel-ip-country`    — set on Vercel Edge.
 *   3. `fly-client-ip-country`  — Fly.io native geo (when available).
 *   4. request.geo.country      — Next.js Edge built-in.
 *
 * If NONE of these are present (local dev), the check is skipped so we
 * don't accidentally block the developer.
 */

const BLOCKED = new Set(["US", "CA", "GB", "CH", "AE"]);

// Paths that the geo-block should NEVER apply to (static assets, the
// unavailable page itself, and health-check style endpoints).
const BYPASS_PATHS = [
  "/geo-unavailable",
  "/_next/",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/robots.txt",
  "/sitemap.xml",
  "/.well-known/",
  "/api/health",
];

function isBypass(pathname: string): boolean {
  return BYPASS_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

function detectCountry(req: NextRequest): string | null {
  const h = req.headers;
  const cf = h.get("cf-ipcountry");
  if (cf) return cf.toUpperCase();
  const vc = h.get("x-vercel-ip-country");
  if (vc) return vc.toUpperCase();
  const fly = h.get("fly-client-ip-country");
  if (fly) return fly.toUpperCase();
  // Next.js Edge geo — only populated on some platforms
  const g = (req as unknown as { geo?: { country?: string } }).geo;
  if (g?.country) return g.country.toUpperCase();
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isBypass(pathname)) return NextResponse.next();

  // Legacy URL redirect: `/app/ipo/*` was renamed to `/app/markets/*`
  // when we reframed NVDA/AAPL/SPY as aftermarket (not IPO). Preserve
  // any bookmarks / external links pointing at the old path.
  if (pathname.startsWith("/app/ipo/") || pathname === "/app/ipo") {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/app\/ipo/, "/app/markets");
    return NextResponse.redirect(url, { status: 308 });
  }

  const country = detectCountry(req);

  // Local dev / unknown edge → allow through (avoids blocking your own team)
  if (!country) return NextResponse.next();

  if (BLOCKED.has(country)) {
    const url = req.nextUrl.clone();
    url.pathname = "/geo-unavailable";
    // Preserve the intended destination so the page can show it if useful.
    url.searchParams.set("from", pathname);
    url.searchParams.set("cc", country);
    return NextResponse.redirect(url, { status: 302 });
  }

  return NextResponse.next();
}

// Run on every page — the BYPASS_PATHS filter above handles static files.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon|apple-icon|robots.txt|sitemap.xml).*)",
  ],
};
