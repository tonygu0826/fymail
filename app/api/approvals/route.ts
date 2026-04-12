import { NextResponse } from "next/server";
import { getApprovals } from "@/lib/approval-data";

export async function GET() {
  try {
    const data = await getApprovals();

    return NextResponse.json({
      success: true,
      data: data.items,
      source: data.source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch approvals",
        },
      },
      { status: 500 }
    );
  }
}