import { NextRequest } from "next/server";

export const maxDuration = 120;

const CHAT_ORIGIN_URL = process.env.CHAT_ORIGIN_URL || "https://clawcc.fywarehouse.com";

export async function POST(req: NextRequest) {
  const body = await req.text();

  try {
    const originRes = await fetch(`${CHAT_ORIGIN_URL}/api/chat-exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    return new Response(originRes.body, {
      status: originRes.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "服务暂时不可用，请稍后重试" },
      { status: 502 }
    );
  }
}
