import { Plus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getTemplates, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title="Template management shell"
        description="Store multilingual outreach templates, merge variable expectations, and template lifecycle state. Editing UI is deferred, but the route and data contracts are ready."
        actions={
          <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            <Plus className="h-4 w-4" />
            New template
          </button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
        <Panel title="Templates" description={`Source: ${templates.source}`}>
          {templates.items.length > 0 ? (
            <div className="space-y-4">
              {templates.items.map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{template.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {template.subject} · {template.language}
                      </p>
                    </div>
                    <StatusPill status={template.status} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                    Updated {formatDate(template.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No templates yet"
              description="Create the first outbound template once form actions are added."
            />
          )}
        </Panel>

        <Panel title="MVP notes" description="The shell is intentionally narrow for the first runnable stage.">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Variables supported by the data model: `companyName`, `contactName`, `countryCode`.</li>
            <li>Planned languages: {mvpOptions.languages.join(", ")}.</li>
            <li>Lifecycle states: {mvpOptions.templateStatuses.join(", ")}.</li>
            <li>Rich text editing and preview rendering are deferred until CRUD is implemented.</li>
          </ul>
        </Panel>
      </section>
    </>
  );
}
