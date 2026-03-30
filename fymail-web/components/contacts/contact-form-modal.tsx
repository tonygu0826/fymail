"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { contactsApi, Contact } from "@/lib/api/contacts";
import { cn } from "@/lib/utils/cn";

interface ContactFormModalProps {
  open: boolean;
  contact?: Contact;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "active", label: "Active" },
  { value: "do_not_contact", label: "Do Not Contact" },
];

const COUNTRY_OPTIONS = [
  "DE", "NL", "GB", "FR", "BE", "CA", "US", "CN", "AU", "SG",
];

const SERVICE_TYPE_OPTIONS = [
  "LCL", "FCL", "Air Freight", "Customs Brokerage",
  "Warehousing", "Distribution", "Last Mile", "Cross-docking",
];

export function ContactFormModal({
  open,
  contact,
  onClose,
  onSaved,
}: ContactFormModalProps) {
  const isEdit = !!contact;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    country: "",
    website: "",
    notes: "",
    status: "cold" as string,
    score: 3,
    tags: "",
    serviceTypes: [] as string[],
  });

  useEffect(() => {
    if (contact) {
      setForm({
        firstName: contact.firstName ?? "",
        lastName: contact.lastName ?? "",
        email: contact.email,
        phone: contact.phone ?? "",
        jobTitle: contact.jobTitle ?? "",
        country: contact.country ?? "",
        website: contact.website ?? "",
        notes: contact.notes ?? "",
        status: contact.status,
        score: contact.score ?? 3,
        tags: contact.tags?.join(", ") ?? "",
        serviceTypes: contact.serviceTypes ?? [],
      });
    } else {
      setForm({
        firstName: "", lastName: "", email: "", phone: "",
        jobTitle: "", country: "", website: "", notes: "",
        status: "cold", score: 3, tags: "", serviceTypes: [],
      });
    }
  }, [contact, open]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? contactsApi.update(contact!.id, data)
        : contactsApi.create(data),
    onSuccess: onSaved,
  });

  const handleSubmit = () => {
    mutation.mutate({
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  const toggleService = (s: string) => {
    setForm((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(s)
        ? prev.serviceTypes.filter((x) => x !== s)
        : [...prev.serviceTypes, s],
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">
            {isEdit ? "Edit Contact" : "Add Contact"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, firstName: e.target.value }))
                }
                placeholder="Tony"
                className={inputCls}
              />
            </Field>
            <Field label="Last name">
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, lastName: e.target.value }))
                }
                placeholder="Granger"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Email *">
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="contact@company.com"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+49 170 ..."
                className={inputCls}
              />
            </Field>
            <Field label="Job title">
              <input
                value={form.jobTitle}
                onChange={(e) =>
                  setForm((p) => ({ ...p, jobTitle: e.target.value }))
                }
                placeholder="Freight Manager"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <select
                value={form.country}
                onChange={(e) =>
                  setForm((p) => ({ ...p, country: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value as any }))
                }
                className={inputCls}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Website">
            <input
              type="url"
              value={form.website}
              onChange={(e) =>
                setForm((p) => ({ ...p, website: e.target.value }))
              }
              placeholder="https://company.com"
              className={inputCls}
            />
          </Field>

          {/* Score */}
          <Field label={`Score: ${form.score}/5`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.score}
              onChange={(e) =>
                setForm((p) => ({ ...p, score: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </Field>

          {/* Service types */}
          <Field label="Service types">
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                    form.serviceTypes.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* Tags */}
          <Field label="Tags (comma-separated)">
            <input
              value={form.tags}
              onChange={(e) =>
                setForm((p) => ({ ...p, tags: e.target.value }))
              }
              placeholder="germany, lcl, follow-up"
              className={inputCls}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Internal notes about this contact..."
              rows={3}
              className={cn(inputCls, "resize-none")}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.email || mutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Save changes" : "Add contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
