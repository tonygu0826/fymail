"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Copy, Pencil, Trash2, FileText, Send, Loader2 } from "lucide-react";
import { templatesApi, Template } from "@/lib/api/templates";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const SEQ_LABELS: Record<number, string> = {
  1: "首封邮件",
  2: "跟进 1",
  3: "跟进 2",
};

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [signature, setSignature] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templatesApi.list(),
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

  const saveMutation = useMutation({
    mutationFn: () => {
      const fullBody = signature
        ? `${bodyHtml}\n\n${signature}`
        : bodyHtml;

      // Extract variables
      const usedVars = Array.from(
        new Set(
          ((fullBody + subject).match(/\{\{(\w+)\}\}/g) ?? []).map(
            (m) => m.slice(2, -2)
          )
        )
      );

      const payload = {
        name: subject.slice(0, 60) || "未命名",
        subject,
        bodyHtml: fullBody,
        bodyText: fullBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        variables: usedVars,
        category: "general",
        targetMarket: "all",
        sequenceOrder: 1,
        language: "en",
        isActive: true,
      };

      if (editingId) {
        return templatesApi.update(editingId, payload);
      }
      return templatesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      resetForm();
    },
  });

  const resetForm = () => {
    setSubject("");
    setBodyHtml("");
    setSignature("");
    setShowCreate(false);
    setEditingId(null);
  };

  const startEdit = (t: Template) => {
    // Try to split signature from body (look for common signature patterns)
    const body = t.bodyHtml;
    const sigSeparators = ["\n\n--\n", "\n\nBest regards", "\n\nKind regards", "\n\nBest,", "\n\nRegards,", "\n\nSincerely"];
    let mainBody = body;
    let sig = "";

    for (const sep of sigSeparators) {
      const idx = body.lastIndexOf(sep);
      if (idx !== -1) {
        mainBody = body.slice(0, idx);
        sig = body.slice(idx).replace(/^\n\n/, "");
        break;
      }
    }

    setSubject(t.subject);
    setBodyHtml(mainBody);
    setSignature(sig);
    setEditingId(t.id);
    setShowCreate(true);
  };

  const templates = (data?.data ?? []).filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="模板管理"
        description="管理和创建开发信邮件模板"
      />

      {/* === Template List Section === */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">模板列表</h2>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="搜索模板..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="暂无模板"
            description="在下方创建第一个开发信模板"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => startEdit(t)}
                onDuplicate={() => duplicateMutation.mutate(t)}
                onDelete={() => {
                  if (confirm(`确认删除 "${t.name}"?`)) deleteMutation.mutate(t.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* === Create / Edit Template Section === */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {editingId ? "编辑模板" : "创建模板"}
          </h2>
          {!showCreate ? (
            <button
              onClick={() => { resetForm(); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              新建模板
            </button>
          ) : (
            <button
              onClick={resetForm}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
          )}
        </div>

        {showCreate && (
          <div className="border border-border rounded-xl bg-card overflow-hidden max-w-2xl">
            {/* Email-like layout */}
            <div className="bg-muted/30 border-b border-border">
              {/* Subject field - like email subject line */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground shrink-0 w-14">主题</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="输入邮件主题，如：与 {{company}} 的合作机会"
                  className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Body field - like email content area */}
            <div className="px-5 py-4">
              <div className="mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">正文内容</span>
              </div>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder={`尊敬的 {{first_name}}，\n\n希望您一切顺利。\n\n我写信是为了探讨我们公司之间的潜在合作机会...`}
                rows={10}
                className="w-full text-sm bg-transparent border border-border rounded-md px-3 py-2.5 resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Signature field - at the bottom like email signature */}
            <div className="px-5 pb-4">
              <div className="border-t border-dashed border-border/60 pt-3">
                <div className="mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">邮件签名</span>
                </div>
                <textarea
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`此致敬礼，\n您的姓名\n您的职位 | 公司名称\n电话：+xx xxx xxxx\n邮箱：your@email.com`}
                  rows={4}
                  className="w-full text-sm bg-muted/30 border border-border rounded-md px-3 py-2.5 resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-muted/20 border-t border-border">
              <button
                onClick={resetForm}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!subject || !bodyHtml || saveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {editingId ? "保存修改" : "创建模板"}
              </button>
            </div>
          </div>
        )}
      </div>
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
            title="复制"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="编辑"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-600"
            title="删除"
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

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          更新于 {format(new Date(t.updatedAt), "MM月dd日")}
        </span>
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            t.isActive ? "bg-emerald-500" : "bg-gray-300"
          )}
          title={t.isActive ? "已启用" : "未启用"}
        />
      </div>
    </div>
  );
}
