"use client";

import { useQuery } from "@tanstack/react-query";
import { contactsApi } from "@/lib/api/contacts";
import { PageHeader } from "@/components/layout/page-header";
import {
  Users, Mail, FileText, Activity,
  TrendingUp, Clock, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

const CAMPAIGN_STATS = { total: 12, running: 3, sent: 4820, avgReplyRate: 6.4 };
const RECENT_ACTIVITY = [
  { id: 1, type: "contact_added", text: "通过CSV导入了新联系人", time: "2分钟前", count: 47 },
  { id: 2, type: "campaign_sent", text: "活动「德国-LCL-三月」已启动", time: "1小时前", count: null },
  { id: 3, type: "reply", text: "收到 kontakt@dhl.de 的回复", time: "3小时前", count: null },
  { id: 4, type: "approval", text: "活动「荷兰-仓储」待审批", time: "5小时前", count: null },
  { id: 5, type: "contact_added", text: "从市场情报导入联系人", time: "昨天", count: 48 },
];

export default function DashboardPage() {
  const { data: contactStats } = useQuery({
    queryKey: ["contacts-stats"],
    queryFn: () => contactsApi.stats(),
  });

  const stats = contactStats?.data;

  return (
    <>
      <PageHeader
        title="工作台"
        description="FYMail 拓客系统总览"
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="联系人总数"
          value={stats?.total ?? 0}
          sub={`本周新增 ${stats?.newThisWeek ?? 0} 个`}
          icon={Users}
          href="/contacts"
          color="blue"
        />
        <MetricCard
          label="进行中活动"
          value={CAMPAIGN_STATS.running}
          sub={`共 ${CAMPAIGN_STATS.total} 个活动`}
          icon={Mail}
          href="/campaigns"
          color="purple"
        />
        <MetricCard
          label="累计发送量"
          value={CAMPAIGN_STATS.sent.toLocaleString()}
          sub={`平均回复率 ${CAMPAIGN_STATS.avgReplyRate}%`}
          icon={TrendingUp}
          href="/campaigns"
          color="teal"
        />
        <MetricCard
          label="待审批"
          value={3}
          sub="需要你处理"
          icon={Clock}
          href="/approvals"
          color="amber"
          urgent
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact breakdown */}
        <div className="lg:col-span-1 border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">联系人池分布</h3>
            <Link href="/contacts" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              查看全部 →
            </Link>
          </div>

          {stats ? (
            <div className="space-y-3">
              <StatusBar label="待开发" value={stats.cold} total={stats.total} color="bg-slate-300 dark:bg-slate-600" />
              <StatusBar label="跟进中" value={stats.warm} total={stats.total} color="bg-amber-400" />
              <StatusBar label="活跃" value={stats.active} total={stats.total} color="bg-emerald-500" />
              <StatusBar
                label="不联系"
                value={Math.max(0, stats.total - stats.cold - stats.warm - stats.active)}
                total={stats.total}
                color="bg-red-400"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>合计</span>
            <span className="font-semibold text-foreground">
              {stats?.total.toLocaleString() ?? "—"}
            </span>
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">最近动态</h3>
          </div>

          <div className="space-y-1">
            {RECENT_ACTIVITY.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  item.type === "reply" && "bg-emerald-100 dark:bg-emerald-900/30",
                  item.type === "contact_added" && "bg-blue-100 dark:bg-blue-900/30",
                  item.type === "campaign_sent" && "bg-purple-100 dark:bg-purple-900/30",
                  item.type === "approval" && "bg-amber-100 dark:bg-amber-900/30",
                )}>
                  {item.type === "reply" && <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {item.type === "contact_added" && <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  {item.type === "campaign_sent" && <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                  {item.type === "approval" && <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {item.text}
                    {item.count && (
                      <span className="ml-1.5 text-xs font-medium text-primary">
                        ({item.count.toLocaleString()} 条)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {[
          { label: "搜索目标客户", sub: "市场情报", href: "/intelligence", icon: "搜" },
          { label: "创建拓客活动", sub: "活动管理", href: "/campaigns/new", icon: "发" },
          { label: "管理邮件模板", sub: "模板库", href: "/templates", icon: "模" },
          { label: "处理审批", sub: "3 条待审", href: "/approvals", icon: "审" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 p-3.5 border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-colors group"
          >
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </>
  );
}

function MetricCard({ label, value, sub, icon: Icon, href, color, urgent }: {
  label: string; value: string | number; sub: string; icon: any;
  href: string; color: "blue" | "purple" | "teal" | "amber"; urgent?: boolean;
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  };
  return (
    <Link href={href} className={cn(
      "border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow group block",
      urgent ? "border-amber-200 dark:border-amber-800" : "border-border"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>
    </Link>
  );
}

function StatusBar({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground">
          {value.toLocaleString()} <span className="text-muted-foreground font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
