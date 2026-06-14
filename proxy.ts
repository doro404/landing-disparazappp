import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// ─── Rate Limiting (in-memory, edge-compatible) ───────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Auth check ───────────────────────────────────────────────────────────────
function checkAdminAuth(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth")) {
    const session = req.cookies.get("admin_session")?.value;
    if (!session || session !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/login")) {
    const session = req.cookies.get("admin_session")?.value;
    if (!session || session !== ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return null;
}

// ─── Proxy ────────────────────────────────────────────────────────────────────
export function proxy(request: NextRequest) {
  // Auth guard first
  const authResponse = checkAdminAuth(request);
  if (authResponse) return authResponse;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!rateLimit(ip)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

  // Admin panel uses inline styles/scripts — use relaxed CSP
  // Public pages use strict nonce-based CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = isAdminRoute
    ? `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data:;
    connect-src 'self' https://license-manager.discloud.app;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `
    : `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'
      https://www.googletagmanager.com
      https://connect.facebook.net
      ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline'
      https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' blob: data:
      https://www.google-analytics.com
      https://www.facebook.com;
    connect-src 'self'
      https://www.google-analytics.com
      https://analytics.google.com
      https://www.facebook.com
      https://connect.facebook.net;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;

  const cspValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspValue);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", cspValue);
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // HSTS — 1 year, includeSubDomains, preload
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  // Disable browser features not needed
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
