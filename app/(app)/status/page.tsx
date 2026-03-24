import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getStatusSummary } from "@/lib/app-data";

export default async function StatusPage() {
  const status = await getStatusSummary();

  return (
    <>
      <PageHeader
        eyebrow="Status"
        title="Working health and status page"
        description="A fast operational check for local development and future deployment verification."
        actions={
          <Link
            href="/api/health"
            className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Open health JSON
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-4">
        <Panel title="App" description="Static runtime status">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Name:</span> {status.app}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Environment:</span> {status.environment}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Version label:</span> {status.version}
            </p>
          </div>
        </Panel>

        <Panel title="Database" description="Live server-side database check">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Configured:</span>{" "}
              {status.database.configured ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Reachable:</span>{" "}
              {status.database.reachable ? "Yes" : "No"}
            </p>
            <p>{status.database.detail}</p>
          </div>
        </Panel>

        <Panel title="Data source" description="How the current UI was populated">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Source:</span> {status.dataSource}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Templates:</span> {status.counts.templates}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Contacts:</span> {status.counts.contacts}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Campaigns:</span> {status.counts.campaigns}
            </p>
          </div>
        </Panel>

        <Panel title="SMTP" description="Safe mail readiness summary">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Provider:</span> {status.smtp.provider}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Ready:</span> {status.smtp.ready ? "Yes" : "No"}
            </p>
            <p>{status.smtp.detail}</p>
          </div>
        </Panel>
      </section>
    </>
  );
}
