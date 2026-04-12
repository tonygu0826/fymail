"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  MapPin,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendData {
  metric: string;
  name: string;
  currentValue: number;
  change: number;
  unit: string;
  trend: "up" | "down" | "stable";
  source: string;
  updatedAt: string;
}

interface PortData {
  name: string;
  country: string;
  tonnage: number;
  period: string;
}

interface TrendsSummary {
  region: string;
  timeframe: string;
  generatedAt: string;
  sources: string[];
  realtime: boolean;
  errors?: string[];
  note: string;
}

// ---------------------------------------------------------------------------
// Static competitor data (kept as-is)
// ---------------------------------------------------------------------------

const competitors = [
  { name: "Kinaxis Warehousing (Montreal)", services: ["仓储", "拆箱", "配送"], location: "蒙特利尔", strength: "本地网络成熟", website: "kinaxis.com" },
  { name: "Montréal Gateway Terminals", services: ["码头仓储", "拆箱", "转运"], location: "蒙特利尔港", strength: "港口直连，拆箱速度快", website: "mtrtml.com" },
  { name: "Ray-Mont Logistics", services: ["转运", "仓储", "集装箱处理"], location: "蒙特利尔", strength: "铁路/公路多式联运", website: "ray-mont.com" },
  { name: "Warehousing & Distribution Inc.", services: ["保税仓储", "拣配", "LCL拆箱"], location: "蒙特利尔", strength: "CBSA保税仓资质", website: "wdi.ca" },
  { name: "Bolloré Logistics Canada", services: ["仓储", "报关", "配送"], location: "蒙特利尔/多伦多", strength: "全球网络，法语服务", website: "bollore-logistics.com" },
  { name: "Yusen Logistics Canada", services: ["仓储", "LCL拆箱", "电商履约"], location: "多伦多/温哥华", strength: "日系精益管理", website: "yusen-logistics.com" },
  { name: "Logistec", services: ["码头运营", "仓储", "散货"], location: "蒙特利尔", strength: "加拿大东部最大码头运营商", website: "logistec.com" },
  { name: "Empire Stevedoring", services: ["码头", "仓储", "拆箱"], location: "蒙特利尔港", strength: "港口作业效率高", website: "empirestevedoring.com" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const trendIcon = (t: "up" | "down" | "stable") => {
  if (t === "up") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (t === "down") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
};

const trendColor = (t: "up" | "down" | "stable") =>
  t === "up" ? "text-green-600" : t === "down" ? "text-red-600" : "text-slate-500";

function formatValue(value: number, unit: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IntelligencePage() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [ports, setPorts] = useState<PortData[]>([]);
  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrends(false);
  }, []);

  const loadTrends = async (forceRefresh: boolean) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        region: "EUROPE",
        ...(forceRefresh ? { refresh: "true" } : {}),
      });
      const res = await fetch(`/api/intelligence/trends?${params}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      setPorts(data.ports || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Failed to load trends:", err);
      setError("数据加载失败，请稍后重试");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="市场情报"
        title="市场趋势与竞争分析"
        description="欧洲海运市场实时数据及加拿大本土仓库竞争对手分析。"
      />

      {/* 页内导航 */}
      <nav className="mb-6 flex gap-3 rounded-2xl border border-theme-border bg-theme-card p-3">
        <a href="#trends" className="rounded-xl bg-theme-card-muted px-4 py-2 text-sm font-medium text-theme-heading hover:bg-theme-border">
          市场趋势
        </a>
        <a href="#competitors" className="rounded-xl bg-theme-card-muted px-4 py-2 text-sm font-medium text-theme-heading hover:bg-theme-border">
          竞争对手
        </a>
      </nav>

      <section className="space-y-6">
        {/* === 市场趋势 === */}
        <div id="trends">
          <Panel
            title="欧洲海运市场趋势"
            description="来自 Drewry WCI、Baltic Exchange、Eurostat 的真实数据"
          >
            {/* Refresh button */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {(summary?.sources || []).map((src) => (
                  <span
                    key={src}
                    className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700"
                  >
                    {src}
                  </span>
                ))}
                {summary?.realtime && (
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    真实数据
                  </span>
                )}
              </div>
              <button
                onClick={() => loadTrends(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-xl bg-theme-card-muted px-3 py-2 text-sm font-medium text-theme-heading hover:bg-theme-border disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "刷新中..." : "刷新数据"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Trends cards */}
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-2xl border border-theme-border bg-theme-card p-5">
                    <div className="animate-pulse">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
                      <div className="mt-4 h-2 rounded-full bg-slate-200" />
                      <div className="mt-2 h-3 w-24 rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : trends.length === 0 ? (
              <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-8 text-center">
                <p className="text-theme-secondary">暂无趋势数据，点击刷新获取最新数据</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trends.map((t) => (
                  <div
                    key={t.metric}
                    className="rounded-2xl border border-theme-border bg-theme-card p-5"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-medium text-theme-heading">{t.name}</h4>
                      <span className="flex items-center gap-1">
                        {trendIcon(t.trend)}
                        <span className={`text-sm font-semibold ${trendColor(t.trend)}`}>
                          {t.change > 0 ? "+" : ""}
                          {t.change.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-theme-heading">
                        {formatValue(t.currentValue, t.unit)}
                      </span>
                      <span className="text-sm text-theme-secondary">{t.unit}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          t.trend === "up"
                            ? "bg-green-500"
                            : t.trend === "down"
                              ? "bg-red-400"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${Math.min(Math.abs(t.change) * 5, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-theme-secondary">{t.source}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Port throughput table */}
            {ports.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-theme-border">
                <table className="min-w-full divide-y divide-theme-border text-sm">
                  <thead className="bg-theme-card-muted">
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-theme-secondary">
                      <th className="px-4 py-3">港口</th>
                      <th className="px-4 py-3">国家</th>
                      <th className="px-4 py-3 text-right">吞吐量 (千吨)</th>
                      <th className="px-4 py-3">年份</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border bg-theme-card">
                    {ports.map((p) => (
                      <tr key={p.name} className="hover:bg-theme-card-muted/50">
                        <td className="px-4 py-3 font-medium text-theme-heading">{p.name}</td>
                        <td className="px-4 py-3 text-theme-body">{p.country || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono text-theme-body">
                          {p.tonnage.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-theme-secondary">{p.period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Data source footer */}
            <div className="mt-4 flex items-center justify-between text-xs text-theme-secondary">
              <span>{summary?.note || ""}</span>
              <span>
                更新: {summary?.generatedAt ? formatTime(summary.generatedAt) : "-"} · 缓存6小时
              </span>
            </div>
            {summary?.errors && summary.errors.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                部分数据源暂不可用: {summary.errors.join("; ")}
              </p>
            )}
          </Panel>
        </div>

        {/* === 竞争对手 === */}
        <div id="competitors">
          <Panel
            title="加拿大本土仓库竞争对手"
            description="蒙特利尔及加拿大主要仓储/拆箱服务商"
          >
            <div className="space-y-4">
              {competitors.map((c) => (
                <div
                  key={c.name}
                  className="rounded-2xl border border-theme-border bg-theme-card p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-theme-secondary" />
                        <h4 className="font-semibold text-theme-heading">{c.name}</h4>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-theme-secondary">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.location}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.services.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-theme-card-muted px-2 py-0.5 text-xs text-theme-secondary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-theme-body">优势：{c.strength}</p>
                    </div>
                    <a
                      href={`https://${c.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      {c.website} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-theme-secondary">
              竞争对手信息基于公开资料整理。如需更深入的竞争分析，请使用深度搜索功能。
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}
