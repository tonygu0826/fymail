import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.API_SECRET_KEY || "";

const PUBLIC_PATHS = ["/api/health"];

export function validateApiRequest(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Allow public endpoints
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  // Skip auth if no API key is configured (development mode)
  if (!API_KEY) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const providedKey = authHeader?.replace("Bearer ", "") || queryKey;

  if (providedKey !== API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}
