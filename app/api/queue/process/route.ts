import { NextResponse } from "next/server";
import { processQueue } from "@/lib/queue";

export async function POST(request: Request) {
  try {
    const { limit = 10 } = await request.json().catch(() => ({}));
    const results = await processQueue({ limit });
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Queue processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to process the queue",
    endpoints: {
      POST: {
        description: "Process pending and retryable emails",
        parameters: {
          limit: "number (optional, default 10)",
        },
      },
    },
  });
}