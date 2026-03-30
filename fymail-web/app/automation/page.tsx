"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Zap, Play, Pause, Trash2, Pencil,
  ChevronUp, ChevronDown, MoreHorizontal,
} from "lucide-react";
import {
  automationApi, AutomationRule,
  TRIGGER_OPTIONS, ACTION_OPTIONS,
} from "@/lib/api/automation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

export default function AutomationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: () => automationApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => automationApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const rules = data?.data ?? [];
  const enabledCount = rules.filter((r) => r.isEnabled).length;

  return (
    <>
      <PageHeader
        title="Automation"
        description={`${rules.length} rules · ${enabledCount} active`}
        actions={
          <button
            onClick={() => router.push("/automation/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建规则
          </button>
        }
      />

      {/* Info banner */}
      <div className="border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 bg-blue-50 dark:bg-blue-900/20 mb-5 flex items-start gap-3">
        <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          规则按优先级顺序执行，数字越小越先执行 (lower number = higher priority). Each rule evaluates its conditions and only fires its actions when all conditions match.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="暂无自动化规则"
          description="创建规则，自动给联系人打标签、评分、推进状态 based on their activity."
          action={
            <button
              onClick={() => router.push("/automation/new")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> 创建第一条规则
            </button>
          }
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule, idx) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                isFirst={idx === 0}
                isLast={idx === rules.length - 1}
                onEdit={() => router.push(`/automation/${rule.id}`)}
                onToggle={() => toggleMutation.mutate(rule.id)}
                onDelete={() => {
                  if (confirm(`Delete rule "${rule.name}"?`)) {
                    deleteMutation.mutate(rule.id);
                  }
                }}
              />
            ))}
        </div>
      )}
    </>
  );
}

function RuleRow({
  rule,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onDelete,
}: {
  rule: AutomationRule;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const trigger = TRIGGER_OPTIONS.find((t) => t.value === rule.triggerType);

  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors",
      !rule.isEnabled && "opacity-60"
    )}>
      {/* Priority indicator */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          disabled={isFirst}
          className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          disabled={isLast}
          className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>

      {/* Priority badge */}
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground">
          {rule.priority + 1}
        </span>
      </div>

      {/* Rule info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-sm font-medium text-foreground truncate">{rule.name}</h4>
          {rule.isEnabled ? (
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full font-medium">
              Active
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded-full font-medium">
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {trigger?.label ?? rule.triggerType}
          </span>
          <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}</span>
          <span>{rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}</span>
          {rule.runCount > 0 && (
            <span className="text-primary">
              已执行 {rule.runCount.toLocaleString()} 次
            </span>
          )}
          {rule.lastRunAt && (
            <span>Last: {format(new Date(rule.lastRunAt), "MMM d")}</span>
          )}
        </div>
      </div>

      {/* Rule preview chips */}
      <div className="hidden lg:flex items-center gap-1.5 flex-wrap max-w-sm">
        {rule.actions.slice(0, 3).map((action, i) => {
          const actionDef = ACTION_OPTIONS.find((a) => a.value === action.type);
          return (
            <span
              key={i}
              className="px-2 py-0.5 text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full font-medium"
            >
              {actionDef?.label ?? action.type}
              {action.params.tag && `: ${action.params.tag}`}
              {action.params.status && `: ${action.params.status}`}
              {action.params.score && `: ${action.params.score}`}
            </span>
          );
        })}
        {rule.actions.length > 3 && (
          <span className="text-[10px] text-muted-foreground">
            +{rule.actions.length - 3} more
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggle}
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title={rule.isEnabled ? "暂停规则" : "启用规则"}
        >
          {rule.isEnabled ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
