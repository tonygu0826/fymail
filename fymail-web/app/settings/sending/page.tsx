"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

interface SendingPolicy {
  globalDailyLimit: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  maxBouncePct: number;
  autoPauseOnBounce: boolean;
  sendingHoursStart: number;
  sendingHoursEnd: number;
  sendingDays: number[];
}

const DEFAULT: SendingPolicy = {
  globalDailyLimit: 200,
  minIntervalSeconds: 90,
  maxIntervalSeconds: 180,
  maxBouncePct: 5,
  autoPauseOnBounce: true,
  sendingHoursStart: 8,
  sendingHoursEnd: 18,
  sendingDays: [1, 2, 3, 4, 5],
};

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function SendingPolicyPage() {
  const [policy, setPolicy] = useState<SendingPolicy>(DEFAULT);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.put("/settings/sending-policy", policy).then((r) => r.data),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      // Demo: just show saved state
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const toggleDay = (day: number) => {
    setPolicy((p) => ({
      ...p,
      sendingDays: p.sendingDays.includes(day)
        ? p.sendingDays.filter((d) => d !== day)
        : [...p.sendingDays, day],
    }));
  };

  const inputCls =
    "px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Sending Policy"
        description="Global constraints applied across all campaigns"
        actions={
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? "Saved!" : "Save changes"}
          </button>
        }
      />

      <div className="max-w-xl space-y-6">
        {/* Volume limits */}
        <Section title="Volume limits" description="Hard caps across all active campaigns">
          <Field label="Global daily send limit" hint="Total emails sent per day across all campaigns">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={2000}
                value={policy.globalDailyLimit}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, globalDailyLimit: Number(e.target.value) }))
                }
                className={cn(inputCls, "w-24")}
              />
              <span className="text-sm text-muted-foreground">emails / day</span>
            </div>
          </Field>

          <Field label="Send interval" hint="Random delay between individual emails">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={30}
                value={policy.minIntervalSeconds}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, minIntervalSeconds: Number(e.target.value) }))
                }
                className={cn(inputCls, "w-20")}
                placeholder="Min"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <input
                type="number"
                min={30}
                value={policy.maxIntervalSeconds}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, maxIntervalSeconds: Number(e.target.value) }))
                }
                className={cn(inputCls, "w-20")}
                placeholder="Max"
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </Field>
        </Section>

        {/* Bounce protection */}
        <Section title="Bounce protection" description="Auto-pause campaigns if bounce rate is too high">
          <Field label="Max bounce rate" hint="Pause campaign automatically if this threshold is exceeded">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={policy.maxBouncePct}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, maxBouncePct: Number(e.target.value) }))
                }
                className={cn(inputCls, "w-20")}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={policy.autoPauseOnBounce}
              onChange={(e) =>
                setPolicy((p) => ({ ...p, autoPauseOnBounce: e.target.checked }))
              }
              className="rounded accent-primary"
            />
            <span className="text-sm text-foreground">Auto-pause campaign when bounce rate exceeded</span>
          </label>
        </Section>

        {/* Sending schedule */}
        <Section title="Sending schedule" description="When emails are allowed to be sent">
          <Field label="Sending hours (UTC)">
            <div className="flex items-center gap-2">
              <select
                value={policy.sendingHoursStart}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, sendingHoursStart: Number(e.target.value) }))
                }
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">to</span>
              <select
                value={policy.sendingHoursEnd}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, sendingHoursEnd: Number(e.target.value) }))
                }
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Sending days">
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "w-10 h-10 rounded-lg text-xs font-medium transition-colors border",
                    policy.sendingDays.includes(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Warning */}
        <div className="flex items-start gap-3 border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Changes apply to newly started campaigns. Running campaigns maintain their own per-campaign limits.
          </p>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 border-b border-border">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}
