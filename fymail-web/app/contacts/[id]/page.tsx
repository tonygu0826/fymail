"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Mail, Phone, Globe, MapPin,
  Building2, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { contactsApi } from "@/lib/api/contacts";
import { ContactStatusBadge, ScoreStars } from "@/components/common/status-badge";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/utils/format";
import { useState } from "react";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => contactsApi.get(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      router.push("/contacts");
    },
  });

  const contact = data?.data;

  return (
    <>
      <PageHeader
        title={
          contact
            ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
              contact.email
            : "Contact"
        }
        description={contact?.jobTitle}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/contacts")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Contacts
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this contact? This cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="max-w-2xl space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !contact ? (
        <p className="text-sm text-muted-foreground">Contact not found.</p>
      ) : (
        <div className="max-w-2xl space-y-5">
          {/* Identity card */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
                {(contact.firstName?.[0] ?? contact.email[0]).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                    "Unknown"}
                </h2>
                {contact.jobTitle && (
                  <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <ContactStatusBadge status={contact.status} />
                  <ScoreStars score={contact.score ?? 3} />
                </div>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
            <SectionHeader label="Contact info" />
            <InfoRow icon={Mail} label="Email" value={contact.email} href={`mailto:${contact.email}`} />
            {contact.phone && (
              <InfoRow icon={Phone} label="Phone" value={contact.phone} href={`tel:${contact.phone}`} />
            )}
            {contact.website && (
              <InfoRow icon={Globe} label="Website" value={contact.website} href={contact.website} external />
            )}
            {contact.country && (
              <InfoRow icon={MapPin} label="Country" value={contact.country} />
            )}
            {contact.companyName && (
              <InfoRow icon={Building2} label="Company" value={contact.companyName} />
            )}
          </div>

          {/* Tags + services */}
          {((contact.tags?.length ?? 0) > 0 || (contact.serviceTypes?.length ?? 0) > 0) && (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              {(contact.tags?.length ?? 0) > 0 && (
                <div className="p-4 border-b border-border last:border-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags!.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(contact.serviceTypes?.length ?? 0) > 0 && (
                <div className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Service types
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.serviceTypes!.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="border border-border rounded-xl p-4 bg-card">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {contact.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <SectionHeader label="Metadata" />
            <div className="divide-y divide-border">
              <MetaRow label="Source" value={contact.source?.replace("_", " ") ?? "Manual"} />
              <MetaRow label="Added" value={formatDate(contact.createdAt)} />
              {contact.lastActivityAt && (
                <MetaRow label="Last activity" value={formatDate(contact.lastActivityAt)} />
              )}
              <MetaRow
                label="Email status"
                value={
                  contact.emailValid === true
                    ? "Verified"
                    : contact.emailValid === false
                    ? "Invalid"
                    : "Unchecked"
                }
              />
            </div>
          </div>
        </div>
      )}

      {contact && (
        <ContactFormModal
          open={editOpen}
          contact={contact}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["contact", id] });
          }}
        />
      )}
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2.5 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: any;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
        >
          {value}
          {external && <ExternalLink className="w-3 h-3 shrink-0" />}
        </a>
      ) : (
        <span className="text-sm text-foreground truncate">{value}</span>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}
