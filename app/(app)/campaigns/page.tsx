import { PlusCircle } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getCampaignComposerData, getCampaigns, getSettingsSummary, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import {
  createCampaignAction,
  executeCampaignAction,
  deleteCampaignAction,
  sendManualSingleEmailAction,
} from "@/app/(app)/campaigns/actions";
import { CampaignActions } from "@/app/(app)/campaigns/campaign-actions";
import { ContactSelector } from "@/app/(app)/campaigns/contact-selector";

type CampaignsPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const [campaigns, composer, settings] = await Promise.all([
    getCampaigns(),
    getCampaignComposerData(),
    getSettingsSummary(),
  ]);
  const canCreateCampaign = composer.templates.length > 0 && composer.contacts.length > 0;
  const canSendSingle =
    composer.source === "database" &&
    composer.templates.length > 0 &&
    composer.contacts.length > 0 &&
    settings.database.reachable &&
    settings.smtp.ready;

  return (
    <>
      <PageHeader
        eyebrow="营销活动"
        title="营销活动管理"
        description="创建营销活动、选择模板和联系人，执行批量邮件发送。"
        actions={
          <a
            href="#create-campaign"
            className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover"
          >
            <PlusCircle className="h-4 w-4" />
            新建营销活动
          </a>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="space-y-6">
        {/* === 营销活动列表 === */}
        <Panel title="营销活动列表" description={`来源：${campaigns.source} · 共 ${campaigns.items.length} 个活动`}>
          {campaigns.items.length > 0 ? (
            <div className="space-y-4">
              {campaigns.items.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-theme-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-theme-heading">{campaign.name}</h3>
                      <p className="mt-1 text-sm text-theme-secondary">
                        模板：{campaign.templateName} · 联系人：{campaign.contactCount} 人
                      </p>
                    </div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-theme-secondary">
                      更新于 {formatDate(campaign.updatedAt)}
                    </p>
                    <CampaignActions
                      campaignId={campaign.id}
                      status={campaign.status}
                      contactCount={campaign.contactCount}
                      executeAction={executeCampaignAction}
                      deleteAction={deleteCampaignAction}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无营销活动"
              description="在下方创建第一个营销活动。"
            />
          )}
        </Panel>

        {/* === 创建营销活动 === */}
        <Panel
          title="创建营销活动"
          description="选择模板和目标联系人，创建营销活动后可直接执行发送。"
        >
          <form id="create-campaign" action={createCampaignAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">营销活动名称 *</span>
                <input
                  name="name"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="Germany Forwarders Batch"
                  required
                  disabled={!canCreateCampaign}
                />
              </label>
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">模板 *</span>
                <select
                  name="templateId"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  disabled={!canCreateCampaign}
                  defaultValue=""
                >
                  <option value="" disabled>
                    选择模板
                  </option>
                  {composer.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.status})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-2 text-sm text-theme-body">
              <span className="font-medium">描述</span>
              <textarea
                name="description"
                className="min-h-20 w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                placeholder="活动说明（可选）"
                disabled={!canCreateCampaign}
              />
            </label>
            <ContactSelector contacts={composer.contacts} disabled={!canCreateCampaign} />
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:cursor-not-allowed disabled:bg-theme-border"
              disabled={!canCreateCampaign}
            >
              创建营销活动
            </button>
          </form>
        </Panel>

        {/* === 手动单次发送 === */}
        <Panel
          title="手动单次发送"
          description="选择模板和联系人，直接发送一封邮件。"
        >
          <form action={sendManualSingleEmailAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">模板</span>
                <select
                  name="templateId"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  defaultValue=""
                  disabled={!canSendSingle}
                >
                  <option value="" disabled>
                    选择模板
                  </option>
                  {composer.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">联系人</span>
                <select
                  name="contactId"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  defaultValue=""
                  disabled={!canSendSingle}
                >
                  <option value="" disabled>
                    选择联系人
                  </option>
                  {composer.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.companyName} · {contact.email} ({contact.status})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-theme-border bg-theme-card-muted px-4 py-3 text-sm text-theme-body">
              <input type="checkbox" name="confirmSingleSend" className="mt-1" disabled={!canSendSingle} />
              <span>我确认发送这封邮件</span>
            </label>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-theme-secondary">
                SMTP 状态：{settings.smtp.ready ? "✓ 就绪" : "✗ 未就绪"}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:cursor-not-allowed disabled:bg-theme-border"
                disabled={!canSendSingle}
              >
                发送邮件
              </button>
            </div>
          </form>
        </Panel>
      </section>
    </>
  );
}
