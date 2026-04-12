import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { FlashMessage } from "@/components/ui/flash-message";
import { getTemplateById, mvpOptions } from "@/lib/app-data";
import { updateTemplateAction } from "@/app/(app)/templates/actions";

type TemplateEditPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function TemplateEditPage({ params, searchParams }: TemplateEditPageProps) {
  const template = await getTemplateById(params.id);

  if (!template) {
    notFound();
  }

  const action = updateTemplateAction.bind(null, template.id);

  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title={`Edit ${template.name}`}
        description="Basic template editing is live for the MVP. Rich previewing and versioning stay out of scope."
        actions={
          <Link
            href="/templates"
            className="inline-flex items-center rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm font-semibold text-theme-heading"
          >
            Back to templates
          </Link>
        }
      />

      {searchParams?.message ? <FlashMessage tone="success" message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <Panel title="Template editor" description="Update the stored template payload and lifecycle state.">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-theme-body">
            <span className="font-medium">Name</span>
            <input
              name="name"
              defaultValue={template.name}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body">
            <span className="font-medium">Slug</span>
            <input
              name="slug"
              defaultValue={template.slug}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body">
            <span className="font-medium">Language</span>
            <select
              name="language"
              defaultValue={template.language}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
            >
              {mvpOptions.languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-theme-body">
            <span className="font-medium">Status</span>
            <select
              name="status"
              defaultValue={template.status}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
            >
              {mvpOptions.templateStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-theme-body md:col-span-2">
            <span className="font-medium">Subject</span>
            <input
              name="subject"
              defaultValue={template.subject}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body md:col-span-2">
            <span className="font-medium">Body HTML</span>
            <textarea
              name="bodyHtml"
              defaultValue={template.bodyHtml}
              className="min-h-40 w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body md:col-span-2">
            <span className="font-medium">Body text</span>
            <textarea
              name="bodyText"
              defaultValue={template.bodyText ?? ""}
              className="min-h-28 w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body md:col-span-2">
            <span className="font-medium">Variables</span>
            <input
              name="variables"
              defaultValue={Array.isArray(template.variables) ? template.variables.join(", ") : ""}
              className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
              placeholder="companyName, contactName, countryCode"
            />
          </label>
          <label className="space-y-2 text-sm text-theme-body md:col-span-2">
            <span className="font-medium">Notes</span>
            <textarea
              name="notes"
              defaultValue={template.notes ?? ""}
              className="min-h-28 w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-theme-heading"
            />
          </label>
          <div className="md:col-span-2 flex items-center justify-between rounded-2xl bg-theme-card-muted px-4 py-3 text-sm text-theme-secondary">
            <span>Template ID: {template.id}</span>
            <button className="rounded-2xl bg-theme-button px-4 py-3 font-semibold text-white hover:bg-theme-button-hover">Save changes</button>
          </div>
        </form>
      </Panel>
    </>
  );
}
