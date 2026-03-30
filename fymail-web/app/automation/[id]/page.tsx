"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Loader2, ChevronRight, Zap } from "lucide-react";
import {
  automationApi,
  AutomationRule,
  RuleCondition,
  RuleAction,
  TriggerType,
  ActionType,
  TRIGGER_OPTIONS,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  ACTION_OPTIONS,
} from "@/lib/api/automation";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

const STATUS_VALUES = ["cold", "warm", "active", "do_not_contact"];

const blankCondition = (): RuleCondition => ({
  field: "country",
  operator: "equals",
  value: "",
});

const blankAction = (): RuleAction => ({
  type: "add_tag",
  params: {},
});

export default function AutomationBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const isNew = !params?.id || params.id === "new";

  const [form, setForm] = useState<{
    name: string;
    triggerType: TriggerType;
    conditions: RuleCondition[];
    actions: RuleAction[];
    isEnabled: boolean;
    priority: number;
  }>({
    name: "",
    triggerType: "contact_imported",
    conditions: [blankCondition()],
    actions: [blankAction()],
    isEnabled: true,
    priority: 0,
  });

  const { data: ruleData } = useQuery({
    queryKey: ["automation-rule", params?.id],
    queryFn: () => automationApi.get(params!.id as string),
    enabled: !isNew,
  });

  useEffect(() => {
    if (ruleData?.data) {
      const r = ruleData.data;
      setForm({
        name: r.name,
        triggerType: r.triggerType,
        conditions: r.conditions.length ? r.conditions : [blankCondition()],
        actions: r.actions.length ? r.actions : [blankAction()],
        isEnabled: r.isEnabled,
        priority: r.priority,
      });
    }
  }, [ruleData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? automationApi.create(form)
        : automationApi.update(params!.id as string, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      router.push("/automation");
    },
  });

  const updateCondition = (idx: number, updates: Partial<RuleCondition>) => {
    setForm((p) => ({
      ...p,
      conditions: p.conditions.map((c, i) =>
        i === idx ? { ...c, ...updates } : c
      ),
    }));
  };

  const updateAction = (idx: number, updates: Partial<RuleAction>) => {
    setForm((p) => ({
      ...p,
      actions: p.actions.map((a, i) =>
        i === idx ? { ...a, ...updates } : a
      ),
    }));
  };

  const removeCondition = (idx: number) =>
    setForm((p) => ({ ...p, conditions: p.conditions.filter((_, i) => i !== idx) }));

  const removeAction = (idx: number) =>
    setForm((p) => ({ ...p, actions: p.actions.filter((_, i) => i !== idx) }));

  const inputCls = "px-2.5 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === form.triggerType);

  return (
    <>
      <PageHeader
        title={isNew ? "New automation rule" : "Edit rule"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/automation")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isNew ? "Create rule" : "Save changes"}
            </button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-6">
        {/* Rule name + settings */}
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Rule name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Tag German contacts on import"
              className={cn(inputCls, "w-full")}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Priority (lower = runs first)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                className={cn(inputCls, "w-24")}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                className="rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground">Enable immediately</span>
            </label>
          </div>
        </div>

        {/* WHEN: Trigger */}
        <Section label="When" icon="⚡" description="What event fires this rule">
          <div className="space-y-3">
            {TRIGGER_OPTIONS.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  form.triggerType === t.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <input
                  type="radio"
                  name="trigger"
                  value={t.value}
                  checked={form.triggerType === t.value}
                  onChange={() => setForm((p) => ({ ...p, triggerType: t.value }))}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* IF: Conditions */}
        <Section
          label="If (all match)"
          icon="?"
          description="Conditions that must all be true"
          action={
            <button
              onClick={() => setForm((p) => ({ ...p, conditions: [...p.conditions, blankCondition()] }))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> Add condition
            </button>
          }
        >
          {form.conditions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No conditions — rule fires for all contacts matching the trigger.
            </p>
          ) : (
            <div className="space-y-2">
              {form.conditions.map((cond, idx) => (
                <ConditionRow
                  key={idx}
                  condition={cond}
                  onChange={(u) => updateCondition(idx, u)}
                  onRemove={() => removeCondition(idx)}
                  inputCls={inputCls}
                />
              ))}
            </div>
          )}
        </Section>

        {/* THEN: Actions */}
        <Section
          label="Then"
          icon="→"
          description="Actions to perform when conditions match"
          action={
            <button
              onClick={() => setForm((p) => ({ ...p, actions: [...p.actions, blankAction()] }))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> Add action
            </button>
          }
        >
          {form.actions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Add at least one action.</p>
          ) : (
            <div className="space-y-2">
              {form.actions.map((action, idx) => (
                <ActionRow
                  key={idx}
                  action={action}
                  onChange={(u) => updateAction(idx, u)}
                  onRemove={() => removeAction(idx)}
                  inputCls={inputCls}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Rule preview */}
        {form.name && (
          <div className="border border-border rounded-xl p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Rule summary</p>
            <p className="text-sm text-foreground">
              <span className="font-medium">When</span> {selectedTrigger?.label}
              {form.conditions.length > 0 && (
                <> and <span className="font-medium">{form.conditions.length} condition{form.conditions.length !== 1 ? "s" : ""}</span> match</>
              )}
              , <span className="font-medium">then</span> run{" "}
              {form.actions.length} action{form.actions.length !== 1 ? "s" : ""}.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Section({
  label,
  icon,
  description,
  children,
  action,
}: {
  label: string;
  icon: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  inputCls,
}: {
  condition: RuleCondition;
  onChange: (u: Partial<RuleCondition>) => void;
  onRemove: () => void;
  inputCls: string;
}) {
  const needsValue = !["is_empty", "is_not_empty"].includes(condition.operator);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={condition.field}
        onChange={(e) => onChange({ field: e.target.value })}
        className={inputCls}
      >
        {CONDITION_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as any })}
        className={inputCls}
      >
        {CONDITION_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {needsValue && (
        condition.field === "status" ? (
          <select
            value={condition.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            className={inputCls}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <input
            value={condition.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="value"
            className={cn(inputCls, "w-32")}
          />
        )
      )}
      <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ActionRow({
  action,
  onChange,
  onRemove,
  inputCls,
}: {
  action: RuleAction;
  onChange: (u: Partial<RuleAction>) => void;
  onRemove: () => void;
  inputCls: string;
}) {
  const paramKey = action.type === "add_tag" || action.type === "remove_tag"
    ? "tag"
    : action.type === "set_status"
    ? "status"
    : action.type === "set_score"
    ? "score"
    : "value";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={action.type}
        onChange={(e) => onChange({ type: e.target.value as ActionType, params: {} })}
        className={inputCls}
      >
        {ACTION_OPTIONS.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>

      {action.type === "set_status" ? (
        <select
          value={(action.params.status as string) ?? ""}
          onChange={(e) => onChange({ params: { status: e.target.value } })}
          className={inputCls}
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : action.type === "set_score" ? (
        <select
          value={(action.params.score as string) ?? "3"}
          onChange={(e) => onChange({ params: { score: e.target.value } })}
          className={inputCls}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} star{n !== 1 ? "s" : ""}</option>
          ))}
        </select>
      ) : (
        <input
          value={(action.params[paramKey] as string) ?? ""}
          onChange={(e) => onChange({ params: { [paramKey]: e.target.value } })}
          placeholder={
            action.type === "add_tag" || action.type === "remove_tag"
              ? "tag name"
              : action.type === "send_notification"
              ? "notification message"
              : "value"
          }
          className={cn(inputCls, "w-40")}
        />
      )}

      <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
