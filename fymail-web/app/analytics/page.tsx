"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Mail, Eye, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

// Static demo data — wire to real API in Phase 5
const WEEKLY_DATA = [
  { day: "Mon", sent: 48, opened: 14, replied: 3 },
  { day: "Tue", sent: 52, opened: 18, replied: 5 },
  { day: "Wed", sent: 61, opened: 22, replied: 7 },
  { day: "Thu", sent: 44, opened: 12, replied: 2 },
  { day: "Fri", sent: 55, opened: 19, replied: 4 },
  { day: "Sat", sent: 12, opened: 4, replied: 1 },
  { day: "Sun", sent: 8, opened: 2, replied: 0 },
];

const MARKET_DATA = [
  { country: "DE", sent: 1240, replied: 87, rate: 7.0 },
  { country: "NL", sent: 890, replied: 71, rate: 8.0 },
  { country: "GB", sent: 760, replied: 42, rate: 5.5 },
  { country: "FR", sent: 430, replied: 19, rate: 4.4 },
  { country: "BE", sent: 280, replied: 18, rate: 6.4 },
];

const TIME_RANGES = ["7d", "30d", "90d"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>("7d");

  const totalSent = WEEKLY_DATA.reduce((s, d) => s + d.sent, 0);
  const totalOpened = WEEKLY_DATA.reduce((s, d) => s + d.opened, 0);
  const totalReplied = WEEKLY_DATA.reduce((s, d) => s + d.replied, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  const maxSent = Math.max(...WEEKLY_DATA.map((d) => d.sent));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="所有活动的拓客效果数据"
        actions={
          <div className="flex border border-border rounded-md overflow-hidden">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Mail} label="发送总量" value={totalSent.toLocaleString()} delta="+12%" positive />
        <KpiCard icon={Eye} label="打开率" value={`${openRate}%`} delta="+2.1pp" positive />
        <KpiCard icon={MessageSquare} label="回复率" value={`${replyRate}%`} delta="-0.4pp" positive={false} />
        <KpiCard icon={Users} label="触达联系人" value="480" delta="+38" positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-foreground">每日发送量</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                Replied
              </span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-40">
            {WEEKLY_DATA.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: "120px" }}>
                  {/* Sent bar */}
                  <div
                    className="w-full rounded-t bg-primary/20 relative overflow-hidden"
                    style={{ height: `${(d.sent / maxSent) * 100}%` }}
                  >
                    {/* Replied overlay */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t"
                      style={{ height: `${d.sent > 0 ? (d.replied / d.sent) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
          {/* Funnel numbers */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{totalSent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{totalOpened}</p>
              <p className="text-xs text-muted-foreground">Opened ({openRate}%)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalReplied}</p>
              <p className="text-xs text-muted-foreground">Replied ({replyRate}%)</p>
            </div>
          </div>
        </div>

        {/* Market breakdown */}
        <div className="border border-border rounded-xl p-5 bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">回复率 by market</h3>
          <div className="space-y-3">
            {MARKET_DATA.map((m) => (
              <div key={m.country}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{m.country}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.replied} / {m.sent.toLocaleString()} ({m.rate}%)
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      m.rate >= 7 ? "bg-emerald-500" : m.rate >= 5 ? "bg-primary" : "bg-muted-foreground/40"
                    )}
                    style={{ width: `${(m.rate / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              最佳市场: <span className="font-medium text-foreground">NL (8.0%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 转化漏斗 */}
      <div className="mt-6 border border-border rounded-xl p-5 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-5">转化漏斗</h3>
        <div className="flex items-end gap-2">
          {[
            { label: "Contacts", value: 4820, pct: 100, color: "bg-primary/20" },
            { label: "Emailed", value: 3240, pct: 67, color: "bg-primary/40" },
            { label: "Opened", value: 890, pct: 18, color: "bg-primary/60" },
            { label: "Replied", value: 214, pct: 4, color: "bg-primary" },
            { label: "Qualified", value: 38, pct: 0.8, color: "bg-emerald-500" },
          ].map((step, i) => (
            <div key={step.label} className="flex-1 text-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn("w-full rounded-t transition-all", step.color)}
                  style={{ height: `${Math.max(step.pct, 2) * 1.2}px` }}
                />
              </div>
              <p className="text-sm font-bold text-foreground mt-2">{step.value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{step.label}</p>
              <p className="text-[10px] text-primary font-medium">{step.pct}%</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  positive,
}: {
  icon: any;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className={cn(
          "flex items-center gap-0.5 text-xs font-medium",
          positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
        )}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
