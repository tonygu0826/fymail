"use client";

import { useState } from "react";
import { RefreshCw, Sparkles, Search } from "lucide-react";

export function SeoActions() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function callAction(action: string, label: string) {
    setLoading(action);
    setResult(null);
    try {
      const res = await fetch(`/api/seo-proxy?action=${action}`, {
        method: "POST",
        signal: AbortSignal.timeout(150000), // 2.5 min client timeout
      });
      const data = await res.json();
      if (data.message) {
        setResult(data.message);
      } else if (data.result) {
        const r = data.result;
        setResult(`生成 ${r.generated || 0} 篇，发布 ${r.published || 0} 篇`);
      } else if (data.discovered) {
        setResult(`发现 ${data.discovered} 个新关键词`);
      } else {
        setResult(JSON.stringify(data).slice(0, 120));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      setResult(`错误: ${msg.includes("abort") ? "请求超时，但后台可能仍在运行" : msg}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => callAction("generate", "生成新闻")}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-4 py-2.5 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {loading === "generate" ? "AI生成中（约30-60秒）..." : "立即生成新闻"}
      </button>
      <button
        onClick={() => callAction("refresh", "刷新内容")}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-2.5 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted disabled:opacity-50"
      >
        <RefreshCw className="h-4 w-4" />
        {loading === "refresh" ? "刷新中..." : "刷新旧文章"}
      </button>
      <button
        onClick={() => callAction("discover", "发现关键词")}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-2.5 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted disabled:opacity-50"
      >
        <Search className="h-4 w-4" />
        {loading === "discover" ? "发现中..." : "发现新关键词"}
      </button>
      {result && (
        <div className="w-full rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {result}
        </div>
      )}
    </div>
  );
}
