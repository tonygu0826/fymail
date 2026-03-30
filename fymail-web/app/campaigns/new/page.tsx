"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Check, Loader2,
  Users, FileText, Settings2, Eye,
} from "lucide-react";
import { campaignsApi } from "@/lib/api/campaigns";
import { contactsApi } from "@/lib/api/contacts";
import { templatesApi } from "@/lib/api/templates";
import { PageHeader } from "@/components/layout/page-header";
import { ContactStatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils/cn";

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { label: "Contacts", icon: Users },
  { label: "Template", icon: FileText },
  { label: "Settings", icon: Settings2 },
  { label: "Review", icon: Eye },
];

interface WizardState {
  name: string;
  contactIds: string[];
  templateId: string;
  senderAccountId: string;
  dailyLimit: number;
  sendIntervalMin: number;
  sendIntervalMax: number;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<WizardState>({
    name: "",
    contactIds: [],
    templateId: "",
    senderAccountId: "",
    dailyLimit: 50,
    sendIntervalMin: 90,
    sendIntervalMax: 180,
  });
  const [contactSearch, setContactSearch] = useState("");

  const { data: contactsData } = useQuery({
    queryKey: ["contacts-wizard", contactSearch],
    queryFn: () =>
      contactsApi.list({ search: contactSearch || undefined, limit: 50 }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["templates-wizard"],
    queryFn: () => templatesApi.list(),
  });

  const { data: sendersData } = useQuery({
    queryKey: ["sender-accounts"],
    queryFn: () => campaignsApi.senderAccounts(),
  });

  const contacts = contactsData?.data ?? [];
  const templates = templatesData?.data ?? [];
  const senders = sendersData?.data ?? [];
  const selectedTemplate = templates.find((t) => t.id === state.templateId);
  const selectedSender = senders.find((s) => s.id === state.senderAccountId);

  const createMutation = useMutation({
    mutationFn: () => campaignsApi.create(state),
    onSuccess: (res) => {
      if (res.data?.id) router.push(`/campaigns/${res.data.id}`);
    },
  });

  const canProceed = () => {
    if (step === 0) return state.name.trim() && state.contactIds.length > 0;
    if (step === 1) return !!state.templateId;
    if (step === 2) return !!state.senderAccountId;
    return true;
  };

  const toggleContact = (id: string) => {
    setState((p) => ({
      ...p,
      contactIds: p.contactIds.includes(id)
        ? p.contactIds.filter((c) => c !== id)
        : [...p.contactIds, id],
    }));
  };

  const inputCls =
    "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="New Campaign"
        actions={
          <button
            onClick={() => router.push("/campaigns")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancel
          </button>
        }
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 max-w-2xl">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary/10 text-primary border-2 border-primary",
                    !done && !active && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:block",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-2",
                    i < step ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="max-w-3xl">
        {/* Step 0: Contacts */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Campaign name *
              </label>
              <input
                value={state.name}
                onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))}
                placeholder="DE-LCL-March-2025"
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Select contacts *
                </label>
                <span className="text-xs text-primary font-medium">
                  {state.contactIds.length} selected
                </span>
              </div>

              {/* Contact search */}
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className={cn(inputCls, "mb-2")}
              />

              <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No contacts found
                  </p>
                ) : (
                  contacts.map((c) => {
                    const selected = state.contactIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border last:border-0",
                          selected && "bg-primary/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleContact(c.id)}
                          className="rounded border-border accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                              c.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.email}
                            {c.country && ` · ${c.country}`}
                          </p>
                        </div>
                        <ContactStatusBadge status={c.status} />
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() =>
                    setState((p) => ({
                      ...p,
                      contactIds: contacts.map((c) => c.id),
                    }))
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Select all visible
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setState((p) => ({ ...p, contactIds: [] }))}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Template */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-1">
              Choose the template for this campaign
            </p>
            {templates.length === 0 ? (
              <div className="border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">No templates yet</p>
                <a href="/templates/new" className="text-sm text-primary hover:underline">
                  Create a template first →
                </a>
              </div>
            ) : (
              templates.filter((t) => t.isActive).map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors",
                    state.templateId === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={state.templateId === t.id}
                    onChange={() =>
                      setState((p) => ({ ...p, templateId: t.id }))
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      {t.targetMarket && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          {t.targetMarket.toUpperCase()}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                        Seq {t.sequenceOrder}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Subject: {t.subject}
                    </p>
                    {t.variables.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Variables: {t.variables.map((v) => `{{${v}}}`).join(", ")}
                      </p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Sender account */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Sender account *
              </label>
              {senders.length === 0 ? (
                <div className="border border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">No sender accounts configured</p>
                  <a href="/settings/email" className="text-sm text-primary hover:underline">
                    Configure SMTP →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {senders.map((s) => (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                        state.senderAccountId === s.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="sender"
                        value={s.id}
                        checked={state.senderAccountId === s.id}
                        onChange={() =>
                          setState((p) => ({ ...p, senderAccountId: s.id }))
                        }
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.email} · Limit: {s.dailyLimit}/day
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Sending limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Daily send limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={state.dailyLimit}
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      dailyLimit: Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Max emails per day. Keep ≤ 50 to avoid spam filters.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Send interval (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={30}
                    value={state.sendIntervalMin}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        sendIntervalMin: Number(e.target.value),
                      }))
                    }
                    className={cn(inputCls, "w-20")}
                    placeholder="Min"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <input
                    type="number"
                    min={30}
                    value={state.sendIntervalMax}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        sendIntervalMax: Number(e.target.value),
                      }))
                    }
                    className={cn(inputCls, "w-20")}
                    placeholder="Max"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Random interval between sends. Mimics human sending.
                </p>
              </div>
            </div>

            {/* Risk summary */}
            <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                Sending estimate
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {state.contactIds.length} contacts ÷ {state.dailyLimit}/day ={" "}
                <strong>
                  ~{Math.ceil(state.contactIds.length / state.dailyLimit)} days
                </strong>{" "}
                to complete. Campaign will require approval before sending.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              <ReviewRow label="Campaign name" value={state.name} />
              <ReviewRow
                label="Contacts"
                value={`${state.contactIds.length} selected`}
              />
              <ReviewRow
                label="Template"
                value={selectedTemplate?.name ?? "—"}
                sub={selectedTemplate?.subject}
              />
              <ReviewRow
                label="Sender"
                value={selectedSender?.name ?? "—"}
                sub={selectedSender?.email}
              />
              <ReviewRow
                label="Daily limit"
                value={`${state.dailyLimit} emails/day`}
              />
              <ReviewRow
                label="Send interval"
                value={`${state.sendIntervalMin}–${state.sendIntervalMax} seconds`}
              />
              <ReviewRow
                label="Estimated duration"
                value={`~${Math.ceil(state.contactIds.length / state.dailyLimit)} days`}
              />
            </div>

            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>This campaign will require approval before sending.</strong>{" "}
                Once created, it will be submitted for review automatically.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            onClick={() => step > 0 && setStep((s) => (s - 1) as Step)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => canProceed() && setStep((s) => (s + 1) as Step)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Create & submit for approval
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
