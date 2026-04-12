"use client";

import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

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
  dataPoints: Record<string, number>;
  errors?: string[];
  note: string;
}

const regionOptions = [
  { value: "EUROPE", label: "欧洲" },
  { value: "GERMANY", label: "德国" },
  { value: "NETHERLANDS", label: "荷兰" },
  { value: "FRANCE", label: "法国" },
  { value: "UK", label: "英国" },
  { value: "BELGIUM", label: "比利时" },
];

const timeframeOptions = [
  { value: "MONTH", label: "本月" },
  { value: "QUARTER", label: "本季度" },
  { value: "YEAR", label: "本年" },
];

function formatValue(value: number, unit: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
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

export default function MarketTrends() {
  const [selectedRegion, setSelectedRegion] = useState("EUROPE");
  const [selectedTimeframe, setSelectedTimeframe] = useState("MONTH");
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [ports, setPorts] = useState<PortData[]>([]);
  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrends(false);
  }, [selectedRegion, selectedTimeframe]);

  const loadTrends = async (forceRefresh: boolean) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        region: selectedRegion,
        timeframe: selectedTimeframe,
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

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-slate-400" />;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable", change: number) => {
    if (trend === "up") return change > 10 ? "text-green-700" : "text-green-600";
    if (trend === "down") return change < -10 ? "text-red-700" : "text-red-600";
    return "text-theme-secondary";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="rounded-2xl border border-theme-border bg-theme-card px-3 py-2 text-sm"
          >
            {regionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="rounded-2xl border border-theme-border bg-theme-card px-3 py-2 text-sm"
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => loadTrends(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-2xl bg-theme-border px-3 py-2 text-sm font-medium text-theme-heading hover:bg-theme-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "刷新中..." : "刷新数据"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Trends Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-theme-border bg-theme-card p-4">
              <div className="animate-pulse">
                <div className="h-4 w-24 rounded bg-slate-200"></div>
                <div className="mt-2 h-6 w-16 rounded bg-slate-200"></div>
                <div className="mt-3 h-2 rounded-full bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-8 text-center">
          <p className="text-theme-secondary">暂无趋势数据，点击刷新获取最新数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {trends.map((trend) => (
            <div
              key={trend.metric}
              className="rounded-2xl border border-theme-border bg-theme-card p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-theme-heading">{trend.name}</h4>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-theme-heading">
                      {formatValue(trend.currentValue, trend.unit)}
                    </span>
                    <span className="text-sm text-theme-secondary">{trend.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {getTrendIcon(trend.trend)}
                  <span
                    className={`text-sm font-medium ${getTrendColor(trend.trend, trend.change)}`}
                  >
                    {trend.change > 0 ? "+" : ""}
                    {trend.change.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    trend.trend === "up"
                      ? trend.change > 10
                        ? "bg-green-600"
                        : "bg-green-400"
                      : trend.trend === "down"
                        ? trend.change < -10
                          ? "bg-red-600"
                          : "bg-red-400"
                        : "bg-slate-400"
                  }`}
                  style={{ width: `${Math.min(Math.abs(trend.change) * 3, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-theme-secondary">{trend.source}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top Ports (when data available) */}
      {ports.length > 0 && (
        <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-theme-heading">
            欧洲主要港口吞吐量 ({ports[0]?.period})
          </h4>
          <div className="space-y-2">
            {ports.map((port) => (
              <div key={port.name} className="flex items-center justify-between text-sm">
                <span className="text-theme-body">
                  {port.name}{port.country ? ` (${port.country})` : ""}
                </span>
                <span className="font-medium text-theme-heading">
                  {formatValue(port.tonnage, "")} 千吨
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Source Info */}
      <div className="rounded-2xl border border-theme-border bg-theme-card-muted p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-theme-heading">数据来源</h4>
          {summary?.realtime && (
            <div className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
              真实数据
            </div>
          )}
        </div>
        {summary ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {(summary.sources || []).map((src) => (
                <span
                  key={src}
                  className="rounded-full bg-intelligence-accent-light px-2 py-1 text-xs font-medium text-intelligence-accent"
                >
                  {src}
                </span>
              ))}
            </div>
            <p className="text-xs text-theme-secondary">{summary.note}</p>
            {summary.errors && summary.errors.length > 0 && (
              <div className="mt-2 text-xs text-amber-600">
                部分数据源暂不可用: {summary.errors.join('; ')}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-theme-secondary">加载中...</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-theme-secondary">
            数据更新时间: {summary?.generatedAt ? formatTime(summary.generatedAt) : '-'}
          </div>
          <div className="text-xs text-theme-secondary">
            缓存6小时 · 点击刷新获取最新
          </div>
        </div>
      </div>
    </div>
  );
}
