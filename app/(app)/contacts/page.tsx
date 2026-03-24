import { Upload, UserPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getContacts, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createContactAction } from "@/app/(app)/contacts/actions";

type ContactsPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const contacts = await getContacts();

  return (
    <>
      <PageHeader
        eyebrow="Contacts"
        title="Contacts management"
        description="Track prospects in PostgreSQL and keep the campaign audience builder supplied with real contact records."
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <Upload className="h-4 w-4" />
              CSV later
            </button>
            <a
              href="#create-contact"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </a>
          </>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Panel title="Prospect list" description={`Source: ${contacts.source}`}>
          {contacts.items.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {contacts.items.map((contact) => (
                    <tr key={contact.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{contact.companyName}</div>
                        <div className="mt-1 text-slate-600">{contact.countryCode}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>{contact.contactName ?? "Unknown contact"}</div>
                        <div className="mt-1">{contact.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={contact.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(contact.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No contacts yet"
              description="Import or create prospects to start assembling campaign audiences."
            />
          )}
        </Panel>

        <Panel title="Add contact" description="Create individual prospects for local testing and campaign drafting.">
          <form id="create-contact" action={createContactAction} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Company name</span>
              <input
                name="companyName"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Forwarder GmbH"
                required
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Contact name</span>
                <input
                  name="contactName"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                  placeholder="Anna Meyer"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                  placeholder="anna@forwarder.example"
                  required
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Country code</span>
                <input
                  name="countryCode"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 uppercase"
                  placeholder="DE"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Status</span>
                <select
                  name="status"
                  defaultValue="NEW"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  {mvpOptions.contactStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Market region</span>
                <input
                  name="marketRegion"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                  placeholder="DACH"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Job title</span>
                <input
                  name="jobTitle"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                  placeholder="Sales Manager"
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Source</span>
              <input
                name="source"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="manual-entry"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Tags</span>
              <input
                name="tags"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="germany, lcl"
              />
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="font-medium">Notes</span>
              <textarea
                name="notes"
                className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                placeholder="Useful context for follow-up"
              />
            </label>
            <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              Save contact
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Supported statuses: {mvpOptions.contactStatuses.join(", ")}. Deduplication anchor for the MVP: unique email address.
          </div>
        </Panel>
      </section>
    </>
  );
}
