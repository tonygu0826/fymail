import { NextResponse } from "next/server";

const SEO_API_BASE = process.env.SEO_API_BASE || "http://localhost:3001";
const SEO_API_KEY = process.env.SEO_API_KEY || "";

async function proxyFetch(endpoint: string, method = "GET", body?: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SEO_API_BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${SEO_API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body && { body }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    if (text.startsWith("<!") || text.startsWith("<html")) {
      throw new Error(`上游返回了HTML而非JSON (HTTP ${res.status})`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

// Fire-and-forget: send request but don't wait for response
function fireAndForget(endpoint: string, method = "POST", body?: string) {
  fetch(`${SEO_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${SEO_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body && { body }),
  }).catch((err) => console.error("Fire-and-forget error:", err));
}

export const maxDuration = 120; // Allow up to 120s for this route

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "generate":
        // AI generation takes 30-60s, fire-and-forget to avoid timeout
        fireAndForget("/api/news/generate/auto", "POST");
        return NextResponse.json({
          message: "新闻生成任务已触发，AI正在后台生成（约30-60秒）。刷新页面查看结果。",
        });

      case "refresh":
        fireAndForget("/api/news/refresh", "POST", '{"maxArticles":5}');
        return NextResponse.json({
          message: "内容刷新任务已触发，后台处理中。刷新页面查看结果。",
        });

      case "discover":
        // Keyword discovery is fast, wait for result
        return NextResponse.json(await proxyFetch("/api/seo/keywords/discover", "POST", '{"maxKeywords":30}', 30000));

      default:
        return NextResponse.json({ message: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "代理请求失败" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ message: "endpoint param required" }, { status: 400 });
  }

  try {
    const data = await proxyFetch(endpoint, "GET", undefined, 30000);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "代理请求失败" },
      { status: 500 }
    );
  }
}
