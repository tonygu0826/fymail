import { Play, PlusCircle } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getCampaigns, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <>
      <PageHeader
        eyebrow="Campaigns"
        title="Campaign management shell"
        description="Define batches of outbound prospects and their template pairing. Queue-backed execution is intentionally out of scope for the first runnable milestone."
        actions={
          <>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
              <Play className="h-4 w-4" />
              Start send
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              <PlusCircle className="h-4 w-4" />
              New campaign
            </button>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
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

        <Panel title="Execution guardrails" description="Current behavior is intentionally conservative.">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Supported lifecycle states: {mvpOptions.campaignStatuses.join(", ")}.</li>
            <li>Campaign send endpoints exist only as reserved contracts until mail infrastructure is real.</li>
            <li>Audience membership is modeled through a dedicated join table for future per-contact delivery state.</li>
            <li>Scheduling fields are present in the schema, even though worker execution is deferred.</li>
          </ul>
        </Panel>
      </section>
    </>
  );
}
