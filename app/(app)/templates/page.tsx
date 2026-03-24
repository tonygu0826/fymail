import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getTemplates, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createTemplateAction } from "@/app/(app)/templates/actions";

type TemplatesPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const templates = await getTemplates();

  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title="Template management"
        description="Create, review, and edit outbound templates backed by Prisma. The MVP keeps editing plain and durable."
        actions={
          <a
            href="#create-template"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            <Plus className="h-4 w-4" />
            New template
          </a>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
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
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <span className="font-mono text-xs uppercase tracking-[0.16em]">{template.slug}</span>
                    <Link href={`/templates/${template.id}`} className="font-semibold text-teal-700">
                      Edit template
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No templates yet"
              description="Create the first outbound template from the form on this page."
            />
          )}
        </Panel>

        <Panel
          title="Create template"
          description="A minimal authoring form for locally testable template persistence."
          className="h-fit"
        >
          <form id="create-template" action={createTemplateAction} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Name</span>
              <input
                name="name"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="EU LCL Intro"
                required
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Slug</span>
              <input
                name="slug"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="eu-lcl-intro"
                required
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Language</span>
                <select
                  name="language"
                  defaultValue="EN"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  {mvpOptions.languages.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Status</span>
                <select
                  name="status"
                  defaultValue="DRAFT"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  {mvpOptions.templateStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Subject</span>
              <input
                name="subject"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Reliable LCL to Canada for European forwarders"
                required
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Body HTML</span>
              <textarea
                name="bodyHtml"
                className="min-h-40 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="<p>Hello {{contactName}},</p>"
                required
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Body text</span>
              <textarea
                name="bodyText"
                className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Hello {{contactName}},"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Variables</span>
              <input
                name="variables"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="companyName, contactName, countryCode"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Notes</span>
              <textarea
                name="notes"
                className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Internal notes for the operator"
              />
            </label>
            <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              Save template
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Variables supported by the data model: `companyName`, `contactName`, `countryCode`.
            Languages available: {mvpOptions.languages.join(", ")}. Preview rendering stays out of scope in this pass.
          </div>
        </Panel>
      </section>
    </>
  );
}
