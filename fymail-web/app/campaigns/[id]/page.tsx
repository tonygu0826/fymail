"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, Pause, CheckCircle,
  XCircle, Mail, Eye, MessageSquare, AlertCircle,
} from "lucide-react";
import { campaignsApi } from "@/lib/api/campaigns";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignStatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => campaignsApi.get(id),
    refetchInterval: (q) =>
      q.state.data?.data?.status === "running" ? 10000 : false,
  });

  const { data: logsData } = useQuery({
    queryKey: ["campaign-logs", id],
    queryFn: () => campaignsApi.logs(id, { limit: 50 }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => campaignsApi.pause(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => campaignsApi.resume(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => campaignsApi.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const c = data?.data;
  const logs = logsData?.data ?? [];

  const openRate = c && c.statSent > 0
    ? Math.round((c.statOpened / c.statSent) * 100) : 0;
  const replyRate = c && c.statSent > 0
    ? Math.round((c.statReplied / c.statSent) * 100) : 0;
  const bounceRate = c && c.statSent > 0
    ? Math.round((c.statBounced / c.statSent) * 100) : 0;
  const progress = c && c.statTotal > 0
    ? Math.round((c.statSent / c.statTotal) * 100) : 0;

  return (
    <>
      <PageHeader
        title={c?.name ?? "Campaign"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/campaigns")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            {c?.status === "draft" && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Submit for approval
              </button>
            )}
            {c?.status === "running" && (
              <button
                onClick={() => pauseMutation.mutate()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
            {c?.status === "paused" && (
              <button
                onClick={() => resumeMutation.mutate()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !c ? (
        <p className="text-sm text-muted-foreground">Campaign not found.</p>
      ) : (
        <>
          {/* Status + meta */}
          <div className="flex items-center gap-3 mb-6">
            <CampaignStatusBadge status={c.status} />
            <span className="text-xs text-muted-foreground">
              {c.contactIds.length} contacts ·{" "}
              {c.senderEmail ?? "—"} ·{" "}
              Created {format(new Date(c.createdAt), "MMM d, yyyy")}
            </span>
          </div>

          {/* Progress bar */}
          {c.statTotal > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{c.statSent.toLocaleString()} sent of {c.statTotal.toLocaleString()}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    c.status === "running" ? "bg-primary" : "bg-muted-foreground/40"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Mail}
              label="Sent"
              value={c.statSent.toLocaleString()}
              color="blue"
            />
            <StatCard
              icon={Eye}
              label="Open rate"
              value={`${openRate}%`}
              color={openRate > 20 ? "green" : "default"}
            />
            <StatCard
              icon={MessageSquare}
              label="Reply rate"
              value={`${replyRate}%`}
              color={replyRate > 5 ? "green" : "default"}
            />
            <StatCard
              icon={AlertCircle}
              label="Bounce rate"
              value={`${bounceRate}%`}
              color={bounceRate > 5 ? "red" : "default"}
            />
          </div>

          {/* Send logs */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Send log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Contact", "Status", "Sent at", "Opened", "Replied"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No send logs yet
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground">
                            {log.contactName || log.contactEmail}
                          </p>
                          {log.contactName && (
                            <p className="text-xs text-muted-foreground">{log.contactEmail}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <LogStatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {log.sentAt
                            ? format(new Date(log.sentAt), "MMM d, HH:mm")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {log.openedAt
                            ? format(new Date(log.openedAt), "MMM d, HH:mm")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {log.repliedAt
                            ? format(new Date(log.repliedAt), "MMM d, HH:mm")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: "blue" | "green" | "red" | "default";
}) {
  const cls = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    default: "bg-muted text-muted-foreground",
  }[color];

  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", cls)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function LogStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    opened: { label: "Opened", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    replied: { label: "Replied", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    bounced: { label: "Bounced", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", cls)}>
      {label}
    </span>
  );
}
