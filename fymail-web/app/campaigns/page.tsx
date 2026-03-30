"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Pause, MoreHorizontal, Mail, MessageSquare, CheckCircle, Users } from "lucide-react";
import { campaignsApi, Campaign } from "@/lib/api/campaigns";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignStatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "pending_approval", label: "待审批" },
  { value: "running", label: "运行中" },
  { value: "completed", label: "已完成" },
];

export default function CampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", activeTab],
    queryFn: () => campaignsApi.list({ status: activeTab || undefined, limit: 50 }),
  });

  const pauseMutation = useMutation({ mutationFn: campaignsApi.pause, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }) });
  const resumeMutation = useMutation({ mutationFn: campaignsApi.resume, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }) });
  const campaigns = data?.data ?? [];

  return (
    <>
      <PageHeader title="活动管理" description="管理和监控拓客邮件活动"
        actions={
          <button onClick={() => router.push("/campaigns/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />新建活动
          </button>
        }
      />

      <div className="flex border-b border-border mb-5">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={cn("px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap",
              activeTab === tab.value ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Mail} title="暂无活动" description="创建第一个拓客活动，开始联系潜在客户"
          action={<button onClick={() => router.push("/campaigns/new")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />新建活动</button>} />
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const openRate = campaign.statSent > 0 ? Math.round((campaign.statOpened / campaign.statSent) * 100) : 0;
            const replyRate = campaign.statSent > 0 ? Math.round((campaign.statReplied / campaign.statSent) * 100) : 0;
            const progress = campaign.statTotal > 0 ? Math.round((campaign.statSent / campaign.statTotal) * 100) : 0;
            return (
              <div key={campaign.id} onClick={() => router.push(`/campaigns/${campaign.id}`)}
                className="border border-border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{campaign.name}</h3>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.contactIds.length.toLocaleString()} 个联系人</span>
                      {campaign.senderEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{campaign.senderEmail}</span>}
                      <span>创建于 {format(new Date(campaign.createdAt), "MM月dd日")}</span>
                      {campaign.statReplied > 0 && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3 h-3" />{campaign.statReplied} 条回复</span>}
                    </div>
                    {campaign.statTotal > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{campaign.statSent.toLocaleString()} / {campaign.statTotal.toLocaleString()} 已发送</span>
                          <span className="text-[10px] text-muted-foreground">{progress}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {campaign.statSent > 0 && (
                      <>
                        <div className="text-center"><p className="text-sm font-semibold text-foreground">{campaign.statSent.toLocaleString()}</p><p className="text-[10px] text-muted-foreground mt-0.5">已发送</p></div>
                        <div className="text-center"><p className={cn("text-sm font-semibold", openRate > 20 ? "text-emerald-600" : "text-foreground")}>{openRate}%</p><p className="text-[10px] text-muted-foreground mt-0.5">打开率</p></div>
                        <div className="text-center"><p className={cn("text-sm font-semibold", replyRate > 5 ? "text-emerald-600" : "text-foreground")}>{replyRate}%</p><p className="text-[10px] text-muted-foreground mt-0.5">回复率</p></div>
                      </>
                    )}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {campaign.status === "running" && <button onClick={() => pauseMutation.mutate(campaign.id)} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground" title="暂停"><Pause className="w-3.5 h-3.5" /></button>}
                      {campaign.status === "paused" && <button onClick={() => resumeMutation.mutate(campaign.id)} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground" title="恢复"><Play className="w-3.5 h-3.5" /></button>}
                      <button className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
