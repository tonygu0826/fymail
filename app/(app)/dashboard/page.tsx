import { ArrowRight, Mail, Megaphone, Users, BarChart3, Clock, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDashboardSummary } from "@/lib/app-data";
import { getRecentEmailLogs } from "@/lib/email-log-data";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [summary, emailLogs] = await Promise.all([
    getDashboardSummary(),
    getRecentEmailLogs(5),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="仪表板"
        title="外拓控制室"
        description="FYWarehouse 欧洲至加拿大拼箱外拓运营概览。"
        actions={
          <Link
            href="/status"
            className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover"
          >
            查看系统状态 <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {/* 页内导航 */}
      <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-theme-border bg-theme-card p-3">
        <a href="#stats" className="rounded-xl bg-theme-card-muted px-3 py-1.5 text-sm font-medium text-theme-heading hover:bg-theme-border">数据概览</a>
        <a href="#campaigns" className="rounded-xl bg-theme-card-muted px-3 py-1.5 text-sm font-medium text-theme-heading hover:bg-theme-border">营销活动</a>
        <a href="#contacts" className="rounded-xl bg-theme-card-muted px-3 py-1.5 text-sm font-medium text-theme-heading hover:bg-theme-border">联系人</a>
        <a href="#emails" className="rounded-xl bg-theme-card-muted px-3 py-1.5 text-sm font-medium text-theme-heading hover:bg-theme-border">邮件日志</a>
      </nav>

      <section className="space-y-6">
        {/* 统计卡片 */}
        <div id="stats" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="模板" value={summary.counts.templates} hint="可复用外拓模板" />
          <StatCard label="联系人" value={summary.counts.contacts} hint="潜在客户总数" />
          <StatCard label="营销活动" value={summary.counts.campaigns} hint="已创建的活动" />
          <StatCard label="就绪联系人" value={summary.counts.readyContacts} tone="accent" hint={`来源：${summary.source}`} />
        </div>

        {/* 最近营销活动 */}
        <div id="campaigns">
        <Panel title="最近营销活动" description="最新的营销活动状态。">
          {summary.recentCampaigns.length > 0 ? (
            <div className="space-y-4">
              {summary.recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-theme-border bg-theme-card-muted/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <Megaphone className="h-4 w-4 text-theme-secondary" />
                        <h3 className="font-semibold text-theme-heading">{campaign.name}</h3>
                      </div>
                      <p className="mt-2 text-sm text-theme-secondary">
                        模板：{campaign.templateName} · 联系人：{campaign.contactCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={campaign.status} />
                      <span className="text-xs text-theme-secondary">{formatDate(campaign.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-secondary">暂无营销活动。</p>
          )}
        </Panel>
        </div>

        {/* 营销活动状态分布 */}
        {summary.campaignBreakdown.length > 0 && (
          <Panel title="营销活动状态分布">
            <div className="space-y-3">
              {summary.campaignBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-2xl border border-theme-border bg-theme-card-muted/70 px-4 py-3">
                  <StatusPill status={item.status} />
                  <span className="text-lg font-semibold text-theme-heading">{item.count}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* 最近联系人 */}
        <div id="contacts">
        <Panel title="最近联系人" description="最新添加的潜在客户。">
          <div className="space-y-3">
            {summary.recentContacts.map((contact) => (
              <div key={contact.id} className="flex flex-col gap-2 rounded-2xl border border-theme-border bg-theme-card-muted/70 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-theme-heading">{contact.companyName}</h3>
                  <p className="mt-1 text-sm text-theme-secondary">
                    {[contact.contactName, contact.email, contact.countryCode].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusPill status={contact.status} />
              </div>
            ))}
          </div>
        </Panel>
        </div>

        {/* 最近邮件发送 */}
        <div id="emails">
        <Panel title="最近邮件发送" description={`来源：${emailLogs.source}`}>
          {emailLogs.items.length > 0 ? (
            <div className="space-y-3">
              {emailLogs.items.map((log) => (
                <div key={log.id} className="rounded-2xl border border-theme-border bg-theme-card-muted/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {log.status === "SENT" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {log.status === "FAILED" && <XCircle className="h-4 w-4 text-red-500" />}
                        {log.status === "PENDING" && <Clock className="h-4 w-4 text-amber-500" />}
                        <h3 className="font-semibold text-theme-heading">{log.subject}</h3>
                      </div>
                      <p className="mt-1 text-sm text-theme-secondary">
                        {log.recipientEmail}
                        {log.contact?.companyName && ` · ${log.contact.companyName}`}
                      </p>
                      {log.errorMessage && <p className="mt-1 text-xs text-red-600">{log.errorMessage}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={log.status} />
                      <span className="text-xs text-theme-secondary">{formatDate(log.sentAt || log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Mail className="mx-auto h-8 w-8 text-theme-secondary" />
              <p className="mt-3 text-sm text-theme-secondary">暂无邮件日志</p>
            </div>
          )}
        </Panel>
        </div>
      </section>
    </>
  );
}
