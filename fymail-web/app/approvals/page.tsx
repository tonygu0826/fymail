"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, MessageSquare, Clock, Users, Mail } from "lucide-react";
import { approvalsApi, Approval } from "@/lib/api/approvals";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const STATUS_TABS = [
  { value: "pending", label: "待审批" },
  { value: "", label: "全部" },
  { value: "approved", label: "已批准" },
  { value: "rejected", label: "已拒绝" },
];

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", activeTab],
    queryFn: () => approvalsApi.list({ status: activeTab || undefined }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id, comment || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["approvals"] }); setSelectedId(null); setComment(""); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id, comment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["approvals"] }); setSelectedId(null); setComment(""); },
  });

  const revisionMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.requestRevision(id, comment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["approvals"] }); setSelectedId(null); setComment(""); },
  });

  const approvals = data?.data ?? [];
  const selected = approvals.find((a) => a.id === selectedId);
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <>
      <PageHeader
        title="审批"
        description={pendingCount > 0 ? `${pendingCount} 个活动等待你的审批` : "活动发送审批队列"}
      />

      <div className="flex border-b border-border mb-5">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setActiveTab(tab.value); setSelectedId(null); }}
            className={cn("px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
              activeTab === tab.value ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-5", selectedId ? "grid-cols-5" : "grid-cols-1")}>
        <div className={selectedId ? "col-span-2" : "col-span-1"}>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : approvals.length === 0 ? (
            <EmptyState icon={CheckCircle} title="暂无审批记录"
              description={activeTab === "pending" ? "没有待审批的活动" : "没有找到审批记录"} />
          ) : (
            <div className="space-y-3">
              {approvals.map((approval) => {
                const statusCfg = {
                  pending: { label: "待审批", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
                  approved: { label: "已批准", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
                  rejected: { label: "已拒绝", cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" },
                  revision_requested: { label: "需修改", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                }[approval.status];
                return (
                  <div key={approval.id} onClick={() => setSelectedId(selectedId === approval.id ? null : approval.id)}
                    className={cn("border rounded-xl p-4 cursor-pointer transition-colors",
                      selectedId === approval.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30")}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {(approval as any).campaignName ?? `活动 #${approval.id.slice(0, 8)}`}
                      </h4>
                      <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium shrink-0", statusCfg?.cls)}>{statusCfg?.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {(approval as any).contactCount && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(approval as any).contactCount} 个联系人</span>}
                      {(approval as any).senderEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{(approval as any).senderEmail}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(approval.createdAt), "MM月dd日")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="col-span-3 border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">审批：{(selected as any).campaignName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                申请时间：{format(new Date(selected.createdAt), "yyyy年MM月dd日 HH:mm")}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(selected as any).contactCount && (
                  <div className="flex items-start gap-2.5 p-3 border border-border rounded-lg">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">收件人数量</p><p className="text-sm font-medium text-foreground">{(selected as any).contactCount} 个联系人</p></div>
                  </div>
                )}
                {(selected as any).senderEmail && (
                  <div className="flex items-start gap-2.5 p-3 border border-border rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">发件账号</p><p className="text-sm font-medium text-foreground">{(selected as any).senderEmail}</p></div>
                  </div>
                )}
              </div>

              {selected.status === "pending" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    审批意见（批准可不填，拒绝必填）
                  </label>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="填写审批意见..." rows={3}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                </div>
              )}

              {selected.comment && (
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">审批意见</p>
                  <p className="text-sm text-foreground">{selected.comment}</p>
                </div>
              )}

              {selected.status === "pending" && (
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={() => approveMutation.mutate(selected.id)} disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />批准
                  </button>
                  <button onClick={() => revisionMutation.mutate(selected.id)} disabled={!comment || revisionMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />要求修改
                  </button>
                  <button onClick={() => rejectMutation.mutate(selected.id)} disabled={!comment || rejectMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />拒绝
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
