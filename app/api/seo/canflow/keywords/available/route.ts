import { NextRequest, NextResponse } from "next/server";
import { fetchAvailableCanflowKeywords } from "@/lib/canflow-keywords";

export const dynamic = "force-dynamic";

// GET /api/seo/canflow/keywords/available?limit=5&minOpportunity=90
// Used by canflow-global/scripts/generate-daily-articles.mjs to fetch
// top-N unconsumed keywords without importing pg directly.
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "5", 10), 1),
      50,
    );
    const minOpportunity = parseInt(
      req.nextUrl.searchParams.get("minOpportunity") || "90",
      10,
    );
    const rows = await fetchAvailableCanflowKeywords(limit, minOpportunity);
    return NextResponse.json({ keywords: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 },
    );
  }
}
