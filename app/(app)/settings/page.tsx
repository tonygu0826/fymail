import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getSettingsSummary } from "@/lib/app-data";

type SettingsPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const settings = await getSettingsSummary();

  return (
    <>
      <PageHeader
        eyebrow="设置"
        title="系统设置"
        description="环境变量配置状态和数据库连接信息。"
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="space-y-6">
        <Panel title="SMTP 邮件配置" description="邮件发送服务状态">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">提供商</p>
                <p className="mt-2 font-medium text-theme-heading">{settings.smtp.provider}</p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">主机 / 端口</p>
                <p className="mt-2 font-medium text-theme-heading">
                  {settings.smtp.host ?? "未配置"} : {settings.smtp.port ?? "-"} ({settings.smtp.secure ? "TLS" : "STARTTLS"})
                </p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">认证状态</p>
                <p className="mt-2 font-medium text-theme-heading">
                  用户名: {settings.smtp.authUserConfigured ? "✓" : "✗"} · 密码: {settings.smtp.authPasswordConfigured ? "✓" : "✗"}
                </p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">发件人</p>
                <p className="mt-2 font-medium text-theme-heading">
                  {settings.smtp.fromName
                    ? `${settings.smtp.fromName} <${settings.smtp.fromEmail ?? "未配置"}>`
                    : settings.smtp.fromEmail ?? "未配置"}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-theme-border bg-theme-card-muted/80 p-4">
              <p className={`font-semibold ${settings.smtp.ready ? "text-green-700" : "text-red-700"}`}>
                {settings.smtp.ready ? "✓ SMTP 就绪" : "✗ SMTP 未就绪"}
              </p>
              <p className="mt-1 text-sm text-theme-secondary">{settings.smtp.detail}</p>
            </div>
          </div>
        </Panel>

        <Panel title="数据库状态" description="数据库连接和数据统计">
          <div className="space-y-3">
            <div className="rounded-2xl border border-theme-border p-4">
              <p className={`font-semibold ${settings.database.reachable ? "text-green-700" : "text-red-700"}`}>
                {settings.database.reachable ? "✓ 数据库已连接" : "✗ 数据库不可达"}
              </p>
              <p className="mt-1 text-sm text-theme-secondary">{settings.database.detail}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-theme-border p-4 text-center">
                <p className="text-2xl font-semibold text-theme-heading">{settings.dataCounts.templates}</p>
                <p className="text-xs text-theme-secondary">模板</p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4 text-center">
                <p className="text-2xl font-semibold text-theme-heading">{settings.dataCounts.contacts}</p>
                <p className="text-xs text-theme-secondary">联系人</p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4 text-center">
                <p className="text-2xl font-semibold text-theme-heading">{settings.dataCounts.campaigns}</p>
                <p className="text-xs text-theme-secondary">营销活动</p>
              </div>
              <div className="rounded-2xl border border-theme-border p-4 text-center">
                <p className="text-2xl font-semibold text-theme-heading">{settings.dataCounts.emailLogs}</p>
                <p className="text-xs text-theme-secondary">邮件日志</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="环境变量" description="检查关键环境变量是否已配置">
          <div className="space-y-3">
            {settings.environment.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl border border-theme-border p-4">
                <span className="font-medium text-theme-heading">{item.key}</span>
                <span className="inline-flex items-center gap-2 text-sm">
                  {item.configured ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> <span className="text-emerald-600">已配置</span></>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 text-amber-600" /> <span className="text-amber-600">缺失</span></>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}
