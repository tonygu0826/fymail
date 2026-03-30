"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import {
  CheckCircle, AlertCircle, XCircle,
  RefreshCw, Database, Mail, Zap, Server,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

interface SystemStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  modules: ModuleStatus[];
  queue: QueueStatus;
  alerts: Alert[];
}

interface ModuleStatus {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  lastChecked: string;
  message?: string;
}

interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
  completed24h: number;
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  module: string;
  createdAt: string;
}

// Fetch from /v1/status — fallback to mock for demo
const MOCK_STATUS: SystemStatus = {
  status: "ok",
  timestamp: new Date().toISOString(),
  version: "1.0.0",
  modules: [
    { name: "Database (PostgreSQL)", status: "ok", latencyMs: 4, lastChecked: new Date().toISOString() },
    { name: "邮件队列 (pg-boss)", status: "ok", latencyMs: 12, lastChecked: new Date().toISOString() },
    { name: "SMTP (ops@fywarehouse.com)", status: "ok", lastChecked: new Date().toISOString() },
    { name: "Intelligence API", status: "degraded", lastChecked: new Date().toISOString(), message: "Rate limited — 3 searches/min" },
    { name: "Tracking Pixel", status: "ok", latencyMs: 2, lastChecked: new Date().toISOString() },
  ],
  queue: { pending: 142, processing: 8, failed: 1, completed24h: 487 },
  alerts: [
    {
      id: "a1", severity: "warning", message: "SMTP daily limit at 82% (41/50)",
      module: "邮件队列", createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "a2", severity: "info", message: "Campaign DE-LCL-March completed successfully",
      module: "Campaigns", createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
};

export default function StatusPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ data: SystemStatus }>("/status");
        return res.data.data;
      } catch {
        return MOCK_STATUS;
      }
    },
    refetchInterval: 30000,
  });

  const s = data ?? MOCK_STATUS;
  const overallColor = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-red-600 dark:text-red-400",
  }[s.status];

  return (
    <>
      <PageHeader
        title="System Status"
        description="FYMail 各服务实时健康监控"
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {/* Overall status */}
      <div className="border border-border rounded-xl p-5 bg-card mb-6 flex items-center gap-4">
        <StatusIcon status={s.status} size="lg" />
        <div>
          <h3 className={cn("text-lg font-semibold", overallColor)}>
            {s.status === "ok" && "所有系统运行正常"}
            {s.status === "degraded" && "检测到部分服务降级"}
            {s.status === "down" && "服务中断"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Last checked {format(new Date(s.timestamp), "HH:mm:ss")} · v{s.version}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">服务状态</h3>
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {s.modules.map((mod) => (
              <ModuleRow key={mod.name} module={mod} />
            ))}
          </div>

          {/* Send queue */}
          <h3 className="text-sm font-semibold text-foreground mt-6">邮件队列</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QueueCard label="待处理" value={s.queue.pending} icon={Mail} color="blue" />
            <QueueCard label="处理中" value={s.queue.processing} icon={Zap} color="purple" />
            <QueueCard label="Failed" value={s.queue.failed} icon={XCircle} color={s.queue.failed > 0 ? "red" : "default"} />
            <QueueCard label="完成(24h)" value={s.queue.completed24h} icon={CheckCircle} color="green" />
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">
            最近告警
            {s.alerts.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full">
                {s.alerts.length}
              </span>
            )}
          </h3>
          {s.alerts.length === 0 ? (
            <div className="border border-border rounded-xl p-6 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">暂无告警</p>
            </div>
          ) : (
            <div className="space-y-2">
              {s.alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatusIcon({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-8 h-8" : "w-4 h-4";
  if (status === "ok") return <CheckCircle className={cn(sz, "text-emerald-500 shrink-0")} />;
  if (status === "degraded") return <AlertCircle className={cn(sz, "text-amber-500 shrink-0")} />;
  return <XCircle className={cn(sz, "text-red-500 shrink-0")} />;
}

function ModuleRow({ module: mod }: { module: ModuleStatus }) {
  const statusLabel = { ok: "正常", degraded: "降级", down: "中断" }[mod.status];
  const statusColor = {
    ok: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-red-600 dark:text-red-400",
  }[mod.status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card">
      <StatusIcon status={mod.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{mod.name}</p>
        {mod.message && (
          <p className="text-xs text-muted-foreground">{mod.message}</p>
        )}
      </div>
      <div className="text-right">
        <p className={cn("text-xs font-medium", statusColor)}>{statusLabel}</p>
        {mod.latencyMs !== undefined && (
          <p className="text-[10px] text-muted-foreground">{mod.latencyMs}ms</p>
        )}
      </div>
    </div>
  );
}

function QueueCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: any;
  color: "blue" | "purple" | "red" | "green" | "default";
}) {
  const cls = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    default: "bg-muted text-muted-foreground",
  }[color];

  return (
    <div className="border border-border rounded-xl p-3 bg-card">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", cls)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = {
    info: { border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300" },
    warning: { border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300" },
    error: { border: "border-red-200 dark:border-red-800", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300" },
  }[alert.severity];

  return (
    <div className={cn("border rounded-lg p-3", cfg.border, cfg.bg)}>
      <p className={cn("text-xs font-medium mb-0.5", cfg.text)}>{alert.module}</p>
      <p className="text-xs text-foreground">{alert.message}</p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {format(new Date(alert.createdAt), "MMM d, HH:mm")}
      </p>
    </div>
  );
}
