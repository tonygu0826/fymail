"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Copy, Pencil, Trash2, FileText } from "lucide-react";
import { templatesApi, Template } from "@/lib/api/templates";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "", label: "全部分类" },
  { value: "lcl", label: "LCL" },
  { value: "warehouse", label: "Warehouse" },
  { value: "general", label: "General" },
];

const MARKETS = [
  { value: "", label: "全部市场" },
  { value: "de", label: "Germany" },
  { value: "nl", label: "Netherlands" },
  { value: "gb", label: "UK" },
  { value: "fr", label: "France" },
  { value: "all", label: "Global" },
];

const SEQ_LABELS: Record<number, string> = {
  1: "1st email",
  2: "Follow-up 1",
  3: "Follow-up 2",
};

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [market, setMarket] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["templates", { category, market }],
    queryFn: () =>
      templatesApi.list({
        category: category || undefined,
        targetMarket: market || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (t: Template) =>
      templatesApi.create({ ...t, id: undefined, name: `${t.name} (copy)` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const templates = (data?.data ?? []).filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Templates"
        description="管理开发信邮件模板"
        actions={
          <button
            onClick={() => router.push("/templates/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建模板
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {MARKETS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="暂无模板"
          description="创建第一个开发信模板，在活动中使用."
          action={
            <button
              onClick={() => router.push("/templates/new")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              新建模板
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => router.push(`/templates/${t.id}`)}
              onDuplicate={() => duplicateMutation.mutate(t)}
              onDelete={() => {
                if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TemplateCard({
  template: t,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors group flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
            onClick={onEdit}
          >
            {t.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 mb-3 line-clamp-3 font-mono leading-relaxed">
        {t.bodyText ??
          t.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {t.targetMarket && (
          <Badge color="blue">{t.targetMarket.toUpperCase()}</Badge>
        )}
        {t.category && (
          <Badge color="purple">{t.category}</Badge>
        )}
        {t.sequenceOrder && (
          <Badge color="gray">{SEQ_LABELS[t.sequenceOrder] ?? `Seq ${t.sequenceOrder}`}</Badge>
        )}
        {t.variables.slice(0, 2).map((v) => (
          <Badge key={v} color="teal">{`{{${v}}}`}</Badge>
        ))}
        {t.variables.length > 2 && (
          <Badge color="gray">+{t.variables.length - 2}</Badge>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {t.language.toUpperCase()} · Updated {format(new Date(t.updatedAt), "MMM d")}
        </span>
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            t.isActive ? "bg-emerald-500" : "bg-gray-300"
          )}
          title={t.isActive ? "Active" : "Inactive"}
        />
      </div>
    </div>
  );
}

function Badge({
  color,
  children,
}: {
  color: "blue" | "purple" | "teal" | "gray";
  children: React.ReactNode;
}) {
  const cls = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    gray: "bg-muted text-muted-foreground",
  }[color];

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", cls)}>
      {children}
    </span>
  );
}
