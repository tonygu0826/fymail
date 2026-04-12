import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_SECRET_KEY = process.env.API_SECRET_KEY || "";

// Paths that don't require session authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/chat",
  "/api/webhooks/",
  "/_next/",
  "/favicon.ico",
];

// API paths that don't require API key authentication
const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/chat",
  "/api/intelligence",
  "/api/deep-search",
  "/api/seo-proxy",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/webhooks/resend",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/** Inline session token verification (no crypto import needed in Edge — use Web Crypto). */
async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry: 7 days
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > 7 * 24 * 60 * 60) return false;

  // Verify HMAC-SHA256 signature using Web Crypto API (Edge compatible)
  const secret = process.env.SESSION_SECRET || "default-dev-secret-change-me";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Check session cookie
  const sessionToken = request.cookies.get("fy-session")?.value;
  const hasValidSession = sessionToken ? await verifySession(sessionToken) : false;

  // For API routes: check session OR API key
  if (pathname.startsWith("/api/")) {
    const isPublicApi = PUBLIC_API_PATHS.some((p) => pathname.startsWith(p));

    if (!isPublicApi) {
      // Check API key
      let hasApiKey = false;
      if (API_SECRET_KEY) {
        const authHeader = request.headers.get("authorization");
        const queryKey = request.nextUrl.searchParams.get("key");
        const providedKey = authHeader?.replace("Bearer ", "") || queryKey;
        hasApiKey = providedKey === API_SECRET_KEY;
      }

      if (!hasValidSession && !hasApiKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // For page routes: require session
  if (!hasValidSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Pass pathname header for layout
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
