import { NextRequest, NextResponse } from "next/server";
import { markCanflowKeywordPublished } from "@/lib/canflow-keywords";

export const dynamic = "force-dynamic";

// POST /api/seo/canflow/keywords/mark-published
// Body: { keywordId: string, slug: string }
// Used by canflow-global/scripts/generate-daily-articles.mjs after it finishes
// writing an article, to mark the consumed keyword as published.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keywordId, slug } = body || {};
    if (!keywordId || !slug) {
      return NextResponse.json(
        { error: "keywordId and slug required" },
        { status: 400 },
      );
    }
    await markCanflowKeywordPublished(keywordId, slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "mark-published failed" },
      { status: 500 },
    );
  }
}
