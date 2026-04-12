"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DailyTraffic = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type TopQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type TopPage = {
  page: string;
  clicks: number;
  impressions: number;
};

type GscData = {
  dailyTraffic: DailyTraffic[];
  topQueries: TopQuery[];
  topPages: TopPage[];
  totals: { clicks: number; impressions: number; avgCtr: number; avgPosition: number };
  dateRange: { start: string; end: string };
};

function formatDate(d: string) {
  return d.slice(5); // "03-15"
}

function shortenUrl(url: string) {
  return url.replace(/https?:\/\/(www\.)?fywarehouse\.com/, "") || "/";
}

export function GscCharts() {
  const [data, setData] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(28);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/seo-proxy?endpoint=/api/seo/search-console?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.message) throw new Error(d.message);
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-theme-secondary">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-theme-secondary border-t-transparent rounded-full" />
        正在加载 Google Search Console 数据...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
        GSC 数据加载失败: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-theme-secondary">
          {data.dateRange.start} ~ {data.dateRange.end}
        </p>
        <div className="flex gap-1">
          {[7, 14, 28].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? "bg-theme-heading text-white"
                  : "bg-theme-card-muted text-theme-secondary hover:bg-theme-border"
              }`}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
          <p className="text-xs uppercase tracking-widest text-theme-secondary">总点击</p>
          <p className="mt-2 text-3xl font-semibold text-theme-heading">{data.totals.clicks}</p>
        </div>
        <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
          <p className="text-xs uppercase tracking-widest text-theme-secondary">总展现</p>
          <p className="mt-2 text-3xl font-semibold text-theme-heading">{data.totals.impressions.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
          <p className="text-xs uppercase tracking-widest text-theme-secondary">平均CTR</p>
          <p className="mt-2 text-3xl font-semibold text-theme-heading">{data.totals.avgCtr}%</p>
        </div>
        <div className="rounded-2xl border border-theme-border bg-theme-card p-4">
          <p className="text-xs uppercase tracking-widest text-theme-secondary">平均排名</p>
          <p className="mt-2 text-3xl font-semibold text-theme-heading">{data.totals.avgPosition}</p>
        </div>
      </div>

      {/* Clicks & Impressions trend chart */}
      <div className="rounded-2xl border border-theme-border bg-theme-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-theme-heading">每日点击量 & 展现量</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.dailyTraffic}>
            <defs>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
              labelFormatter={(v) => `日期: ${v}`}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Area yAxisId="right" type="monotone" dataKey="impressions" name="展现量" stroke="#10b981" fill="url(#colorImpressions)" />
            <Area yAxisId="left" type="monotone" dataKey="clicks" name="点击量" stroke="#6366f1" fill="url(#colorClicks)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Queries */}
      <div className="rounded-2xl border border-theme-border bg-theme-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-theme-heading">热门搜索词 TOP 10</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.topQueries.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis
              dataKey="query"
              type="category"
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
              width={120}
            />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
              formatter={(value: any, name: any) => [value, name === "impressions" ? "展现" : "点击"]}
            />
            <Bar dataKey="impressions" name="展现" fill="#a5b4fc" radius={[0, 4, 4, 0]} />
            <Bar dataKey="clicks" name="点击" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Pages table */}
      <div className="rounded-2xl border border-theme-border bg-theme-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-theme-heading">热门页面</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme-border text-left text-xs uppercase tracking-wider text-theme-secondary">
              <th className="pb-2 pr-4">页面</th>
              <th className="pb-2 pr-4 text-right">点击</th>
              <th className="pb-2 pr-4 text-right">展现</th>
              <th className="pb-2 pr-4 text-right">CTR</th>
              <th className="pb-2 text-right">排名</th>
            </tr>
          </thead>
          <tbody>
            {data.topPages.slice(0, 10).map((p) => (
              <tr key={p.page} className="border-b border-theme-border/50">
                <td className="py-2 pr-4 text-theme-heading">{shortenUrl(p.page)}</td>
                <td className="py-2 pr-4 text-right font-semibold text-indigo-600">{p.clicks}</td>
                <td className="py-2 pr-4 text-right text-theme-body">{p.impressions}</td>
                <td className="py-2 pr-4 text-right text-theme-body">{(p as any).ctr || '-'}%</td>
                <td className="py-2 text-right text-theme-body">{(p as any).position || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
