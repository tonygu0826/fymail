import { Play, PlusCircle } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getCampaignComposerData, getCampaigns, getSettingsSummary, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createCampaignAction, sendManualSingleEmailAction } from "@/app/(app)/campaigns/actions";

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
        eyebrow="Campaigns"
        title="Campaign drafts"
        description="Create draft campaigns with a real template and contact selection. Send execution stays intentionally out of scope."
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <Play className="h-4 w-4" />
              Draft only
            </button>
            <a
              href="#create-campaign"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              <PlusCircle className="h-4 w-4" />
              New campaign
            </a>
          </>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Panel title="Campaign list" description={`Source: ${campaigns.source}`}>
          {campaigns.items.length > 0 ? (
            <div className="space-y-4">
              {campaigns.items.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Template: {campaign.templateName} · Contacts: {campaign.contactCount}
                      </p>
                    </div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                    Updated {formatDate(campaign.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No campaigns yet"
              description="Campaigns will appear here once creation flows are added."
            />
          )}
        </Panel>

        <Panel
          title="Create draft"
          description="Choose one template and at least one contact to make the draft campaign operable."
        >
          <form id="create-campaign" action={createCampaignAction} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Campaign name</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Germany Forwarders Batch"
                required
                disabled={!canCreateCampaign}
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Description</span>
              <textarea
                name="description"
                className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Optional internal note for this draft"
                disabled={!canCreateCampaign}
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Template</span>
              <select
                name="templateId"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                disabled={!canCreateCampaign}
                defaultValue=""
              >
                <option value="" disabled>
                  Select a template
                </option>
                {composer.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.status})
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Contacts</span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {composer.contacts.length} available
                </span>
              </div>
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {composer.contacts.length > 0 ? (
                  composer.contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        name="contactIds"
                        value={contact.id}
                        className="mt-1"
                        disabled={!canCreateCampaign}
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">{contact.companyName}</span>
                        <span className="mt-1 block text-slate-600">
                          {[contact.contactName, contact.email, contact.status].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">Create contacts before drafting a campaign.</p>
                )}
              </div>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canCreateCampaign}
            >
              Save campaign draft
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Supported lifecycle states: {mvpOptions.campaignStatuses.join(", ")}. This MVP only creates drafts and stores target contact links.
          </div>
        </Panel>
      </section>

      <Panel
        title="Manual single send"
        description="Controlled D1 send path: one selected template to one selected contact through real SMTP."
      >
        <form action={sendManualSingleEmailAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Template</span>
              <select
                name="templateId"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                defaultValue=""
                disabled={!canSendSingle}
              >
                <option value="" disabled>
                  Select a template
                </option>
                {composer.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.status})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Contact</span>
              <select
                name="contactId"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                defaultValue=""
                disabled={!canSendSingle}
              >
                <option value="" disabled>
                  Select a contact
                </option>
                {composer.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.companyName} · {contact.email} ({contact.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" name="confirmSingleSend" className="mt-1" disabled={!canSendSingle} />
            <span>
              I understand this is a guarded manual single-send. FyMail D1 has no queue, rate limiting,
              batching, retry worker, or unsubscribe automation yet.
            </span>
          </label>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              <p>SMTP readiness: {settings.smtp.ready ? "Ready" : "Blocked"}</p>
              <p>{settings.smtp.detail}</p>
            </div>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canSendSingle}
            >
              Send one real email
            </button>
          </div>
        </form>
      </Panel>
    </>
  );
}
