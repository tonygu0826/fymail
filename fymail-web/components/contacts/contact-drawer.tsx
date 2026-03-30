"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Mail, Phone, Globe, MapPin, Building2,
  Pencil, Trash2, ExternalLink, Clock,
} from "lucide-react";
import { contactsApi } from "@/lib/api/contacts";
import { ContactStatusBadge, ScoreStars } from "@/components/common/status-badge";
import { ContactFormModal } from "./contact-form-modal";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

interface ContactDrawerProps {
  contactId: string | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ContactDrawer({ contactId, onClose, onDeleted }: ContactDrawerProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => contactsApi.get(contactId!),
    enabled: !!contactId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(contactId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onDeleted();
    },
  });

  const contact = data?.data;
  const isOpen = !!contactId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-[420px] bg-card border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Contact Detail</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this contact?")) deleteMutation.mutate();
              }}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !contact ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              Contact not found
            </div>
          ) : (
            <>
              {/* Identity */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
                    {(contact.firstName?.[0] ?? contact.email[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {[contact.firstName, contact.lastName]
                        .filter(Boolean)
                        .join(" ") || "Unknown"}
                    </h2>
                    {contact.jobTitle && (
                      <p className="text-sm text-muted-foreground">
                        {contact.jobTitle}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <ContactStatusBadge status={contact.status} />
                      <ScoreStars score={contact.score ?? 3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="p-5 border-b border-border space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Contact Info
                </h4>
                <InfoRow icon={Mail} label="Email" value={contact.email} href={`mailto:${contact.email}`} />
                {contact.phone && (
                  <InfoRow icon={Phone} label="Phone" value={contact.phone} href={`tel:${contact.phone}`} />
                )}
                {contact.website && (
                  <InfoRow
                    icon={Globe}
                    label="Website"
                    value={contact.website}
                    href={contact.website}
                    external
                  />
                )}
                {contact.country && (
                  <InfoRow icon={MapPin} label="Country" value={contact.country} />
                )}
                {contact.companyName && (
                  <InfoRow icon={Building2} label="Company" value={contact.companyName} />
                )}
              </div>

              {/* Tags */}
              {(contact.tags?.length ?? 0) > 0 && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Tags
                  </h4>
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

              {/* Service types */}
              {(contact.serviceTypes?.length ?? 0) > 0 && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Service Types
                  </h4>
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

              {/* Notes */}
              {contact.notes && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Notes
                  </h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {contact.notes}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="p-5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Metadata
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium capitalize">
                      {contact.source?.replace("_", " ") ?? "Manual"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Added</span>
                    <span className="font-medium">
                      {format(new Date(contact.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  {contact.lastActivityAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last activity</span>
                      <span className="font-medium">
                        {format(new Date(contact.lastActivityAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Edit modal */}
      {contact && (
        <ContactFormModal
          open={editOpen}
          contact={contact}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
      )}
    </>
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
    <div className="flex items-start gap-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="text-sm text-primary hover:underline truncate flex items-center gap-1"
          >
            {value}
            {external && <ExternalLink className="w-3 h-3" />}
          </a>
        ) : (
          <p className="text-sm text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
