import { Upload, UserPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getContacts, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <>
      <PageHeader
        eyebrow="Contacts"
        title="Contacts management shell"
        description="Track European forwarder prospects, contact status, and segmentation. Import and edit actions are intentionally represented as shells in this MVP."
        actions={
          <>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4" />
              Add contact
            </button>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
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

        <Panel title="Segmentation model" description="Contact shape and statuses already match the planned Prisma schema.">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Supported statuses: {mvpOptions.contactStatuses.join(", ")}.</li>
            <li>Current audience focus: European freight forwarders for Canada-bound LCL offers.</li>
            <li>CSV import endpoint is reserved but intentionally not implemented in this milestone.</li>
            <li>Deduplication anchor for MVP: unique email address.</li>
          </ul>
        </Panel>
      </section>
    </>
  );
}
