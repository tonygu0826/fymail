import { ArrowRight, Database, Mail, Megaphone, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDashboardSummary } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Outbound prospecting control room"
        description="Track the MVP readiness of templates, contacts, and campaigns for FYWarehouse’s Europe-to-Canada LCL outreach."
        actions={
          <Link
            href="/status"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            View system status
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Templates"
          value={summary.counts.templates}
          hint="Reusable outreach foundations"
        />
        <StatCard label="Contacts" value={summary.counts.contacts} hint="Prospects in the current dataset" />
        <StatCard
          label="Campaigns"
          value={summary.counts.campaigns}
          hint="Draft or scheduled outreach batches"
        />
        <StatCard
          label="Ready Contacts"
          value={summary.counts.readyContacts}
          tone="accent"
          hint={`Source: ${summary.source}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Panel
          title="Recent campaigns"
          description="The campaign shell is present. Send orchestration is deferred until SMTP and queueing are implemented."
        >
          <div className="space-y-4">
            {summary.recentCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Megaphone className="h-4 w-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Template: {campaign.templateName} · Contacts: {campaign.contactCount}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={campaign.status} />
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatDate(campaign.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Operational readiness"
          description="The MVP surfaces core state while keeping external integrations honest."
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <Mail className="mt-0.5 h-4 w-4 text-teal-700" />
              <div>
                <h3 className="font-semibold text-slate-900">Mail delivery</h3>
                <p className="mt-1 text-sm text-slate-600">
                  SMTP wiring is planned, but outbound send execution is not implemented in this stage.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <Database className="mt-0.5 h-4 w-4 text-teal-700" />
              <div>
                <h3 className="font-semibold text-slate-900">Database-backed if configured</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Pages use Prisma when the environment is ready and fall back to safe demo data otherwise.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <Users className="mt-0.5 h-4 w-4 text-teal-700" />
              <div>
                <h3 className="font-semibold text-slate-900">Single-user mode</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Auth and permissions are intentionally deferred while the operator workflow is stabilized.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent contacts" description="Latest prospects visible to the system.">
          <div className="space-y-3">
            {summary.recentContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="font-semibold text-slate-900">{contact.companyName}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {[contact.contactName, contact.email, contact.countryCode].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusPill status={contact.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Campaign status mix" description="High-level campaign distribution for the current data source.">
          <div className="space-y-3">
            {summary.campaignBreakdown.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <StatusPill status={item.status} />
                </div>
                <span className="text-lg font-semibold text-slate-950">{item.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}
