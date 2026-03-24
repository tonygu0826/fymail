import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { seedMvpAction } from "@/app/(app)/settings/actions";
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
        eyebrow="Settings"
        title="Basic settings page"
        description="Environment readiness and non-secret application settings. Secret mail credentials stay in environment variables and are never surfaced in the repo."
        actions={
          <form action={seedMvpAction}>
            <button className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
              Seed local MVP data
            </button>
          </form>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Environment readiness" description="Presence check only. Secret values are not displayed.">
          <div className="space-y-3">
            {settings.environment.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
              >
                <span className="font-medium text-slate-900">{item.key}</span>
                <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                  {item.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  {item.configured ? "Configured" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="App settings" description="Persisted non-secret settings when Prisma is connected, otherwise safe defaults.">
          <div className="space-y-3">
            {settings.appSettings.map((setting) => (
              <div key={setting.key} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{setting.key}</p>
                <p className="mt-2 font-medium text-slate-900">{setting.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Safe runtime config" description="Useful live values that are safe to show in the UI.">
          <div className="space-y-3">
            {settings.publicConfig.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.key}</p>
                <p className="mt-2 font-medium text-slate-900">{item.value}</p>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Stored data" description="Live record counts for the current local database.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Templates</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{settings.dataCounts.templates}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Contacts</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{settings.dataCounts.contacts}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Campaigns</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{settings.dataCounts.campaigns}</p>
            </div>
          </div>
        </Panel>
      </section>

      <Panel title="Database readiness" description="Connectivity is checked live from the server.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="font-semibold text-slate-900">
            {settings.database.reachable ? "Database reachable" : "Database not reachable"}
          </p>
          <p className="mt-2 text-sm text-slate-600">{settings.database.detail}</p>
          <p className="mt-3 text-sm text-slate-600">
            The seed action writes a local operator, sample template, sample contacts, a draft campaign,
            and safe non-secret settings rows.
          </p>
        </div>
      </Panel>
    </>
  );
}
