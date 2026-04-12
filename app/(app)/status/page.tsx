import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getStatusSummary } from "@/lib/app-data";
import { getQueueStats } from "@/lib/queue-stats";

export default async function StatusPage() {
  const [status, queueStats] = await Promise.all([
    getStatusSummary(),
    getQueueStats().catch(() => null),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="状态"
        title="系统状态"
        description="运行状态和邮件队列监控。"
      />

      <section className="space-y-6">
        <Panel title="系统概览">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">应用</p>
                <p className="mt-1 font-medium text-theme-heading">{status.app} · {status.environment}</p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">数据库</p>
                <p className={`mt-1 font-medium ${status.database.reachable ? "text-green-700" : "text-red-700"}`}>
                  {status.database.reachable ? "✓ 已连接" : "✗ 不可达"}
                </p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">SMTP</p>
                <p className={`mt-1 font-medium ${status.smtp.ready ? "text-green-700" : "text-red-700"}`}>
                  {status.smtp.ready ? "✓ 就绪" : "✗ 未就绪"} · {status.smtp.provider}
                </p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">数据</p>
                <p className="mt-1 font-medium text-theme-heading">
                  模板 {status.counts.templates} · 联系人 {status.counts.contacts} · 活动 {status.counts.campaigns}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {queueStats && (
          <Panel title="邮件队列" description="邮件发送状态监控">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-theme-border bg-theme-card p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{queueStats.pending}</div>
                  <div className="text-sm text-theme-secondary">待处理</div>
                </div>
                <div className="rounded-2xl border border-theme-border bg-theme-card p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
                  <div className="text-sm text-theme-secondary">失败</div>
                </div>
                <div className="rounded-2xl border border-theme-border bg-theme-card p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{queueStats.sent}</div>
                  <div className="text-sm text-theme-secondary">已发送</div>
                </div>
                <div className="rounded-2xl border border-theme-border bg-theme-card p-4 text-center">
                  <div className="text-2xl font-bold text-theme-heading">{queueStats.total}</div>
                  <div className="text-sm text-theme-secondary">总计</div>
                </div>
              </div>

              {queueStats.recentFailed.length > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold text-theme-heading">最近失败</h3>
                  <div className="space-y-3">
                    {queueStats.recentFailed.map((log) => (
                      <div key={log.id} className="rounded-2xl border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-red-800">{log.recipientEmail}</div>
                          <div className="text-xs text-red-600">重试 {log.retryCount}/{log.maxRetries}</div>
                        </div>
                        {log.errorMessage && <p className="mt-1 truncate text-xs text-red-600">{log.errorMessage}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}
      </section>
    </>
  );
}
