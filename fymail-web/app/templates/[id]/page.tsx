"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Eye, Code, Plus, X } from "lucide-react";
import { templatesApi } from "@/lib/api/templates";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

const AVAILABLE_VARS = [
  "first_name", "last_name", "company", "job_title",
  "country", "service_type", "website",
];

const CATEGORY_OPTIONS = [
  { value: "lcl", label: "LCL" },
  { value: "warehouse", label: "Warehouse" },
  { value: "general", label: "General" },
];

const MARKET_OPTIONS = [
  { value: "de", label: "Germany (DE)" },
  { value: "nl", label: "Netherlands (NL)" },
  { value: "gb", label: "UK (GB)" },
  { value: "fr", label: "France (FR)" },
  { value: "be", label: "Belgium (BE)" },
  { value: "all", label: "Global (All)" },
];

type Tab = "edit" | "preview";

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const isNew = !params?.id || params.id === "new";

  const [tab, setTab] = useState<Tab>("edit");
  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    category: "general",
    targetMarket: "all",
    businessType: "",
    sequenceOrder: 1,
    language: "en",
    isActive: true,
  });
  const [previewHtml, setPreviewHtml] = useState("");

  const { data: templateData } = useQuery({
    queryKey: ["template", params?.id],
    queryFn: () => templatesApi.get(params!.id as string),
    enabled: !isNew,
  });

  useEffect(() => {
    if (templateData?.data) {
      const t = templateData.data;
      setForm({
        name: t.name,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText ?? "",
        category: t.category ?? "general",
        targetMarket: t.targetMarket ?? "all",
        businessType: t.businessType ?? "",
        sequenceOrder: t.sequenceOrder,
        language: t.language,
        isActive: t.isActive,
      });
    }
  }, [templateData]);

  // Extract variables used in body
  const usedVars = Array.from(
    new Set([
      ...((form.bodyHtml + form.subject).match(/\{\{(\w+)\}\}/g) ?? []).map(
        (m) => m.slice(2, -2)
      ),
    ])
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? templatesApi.create({ ...form, variables: usedVars })
        : templatesApi.update(params!.id as string, {
            ...form,
            variables: usedVars,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      router.push("/templates");
    },
  });

  const insertVar = (v: string) => {
    setForm((p) => ({
      ...p,
      bodyHtml: p.bodyHtml + `{{${v}}}`,
    }));
  };

  // Simple preview: replace vars with placeholders
  const renderPreview = () => {
    let html = form.bodyHtml;
    const replacements: Record<string, string> = {
      first_name: "John",
      last_name: "Müller",
      company: "DHL Freight GmbH",
      job_title: "Freight Manager",
      country: "Germany",
      service_type: "LCL Import",
      website: "dhl.de",
    };
    Object.entries(replacements).forEach(([k, v]) => {
      html = html.replaceAll(`{{${k}}}`, `<mark style="background:#fef9c3;padding:0 2px">${v}</mark>`);
    });
    setPreviewHtml(html);
    setTab("preview");
  };

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );

  const inputCls = "w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title={isNew ? "新建模板" : "编辑模板"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/templates")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回
            </button>
            <button
              onClick={renderPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              预览
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.subject || !form.bodyHtml || saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isNew ? "创建模板" : "保存修改"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main editor */}
        <div className="xl:col-span-3 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["edit", "preview"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => t === "preview" ? renderPreview() : setTab("edit")}
                className={cn(
                  "px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px",
                  tab === t
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "edit" ? "编辑器" : "预览"}
              </button>
            ))}
          </div>

          {tab === "edit" ? (
            <div className="space-y-4">
              {field("模板名称 *",
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="DE-LCL-First-Contact-EN"
                  className={inputCls}
                />
              )}
              {field("邮件主题 *",
                <input
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="与 {{company}} 的合作机会 — FYWarehouse"
                  className={inputCls}
                />
              )}
              {field("邮件正文（支持 HTML）*",
                <textarea
                  value={form.bodyHtml}
                  onChange={(e) => setForm((p) => ({ ...p, bodyHtml: e.target.value }))}
                  placeholder={`尊敬的 {{first_name}}，\n\n希望您一切顺利...`}
                  rows={16}
                  className={cn(inputCls, "resize-none font-mono text-xs leading-relaxed")}
                />
              )}
              {/* Detected variables */}
              {usedVars.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">检测到的变量：</span>
                  {usedVars.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded font-mono"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-xl p-6 bg-white dark:bg-card min-h-[400px]">
              <div className="mb-4 pb-4 border-b border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">主题</p>
                <p className="text-sm font-medium"
                  dangerouslySetInnerHTML={{
                    __html: form.subject.replace(
                      /\{\{(\w+)\}\}/g,
                      '<mark style="background:#fef9c3;padding:0 2px">$1</mark>'
                    ),
                  }}
                />
              </div>
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewHtml || form.bodyHtml }}
              />
            </div>
          )}
        </div>

        {/* Sidebar: settings */}
        <div className="space-y-5">
          {/* Variable picker */}
          <div className="border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
              插入变量
            </h4>
            <div className="space-y-1">
              {AVAILABLE_VARS.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left group"
                >
                  <span className="font-mono text-primary">{`{{${v}}}`}</span>
                  <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              元数据
            </h4>
            {field("分类",
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputCls}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {field("目标市场",
              <select value={form.targetMarket} onChange={(e) => setForm((p) => ({ ...p, targetMarket: e.target.value }))} className={inputCls}>
                {MARKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {field("发送顺序",
              <select value={form.sequenceOrder} onChange={(e) => setForm((p) => ({ ...p, sequenceOrder: Number(e.target.value) }))} className={inputCls}>
                <option value={1}>首封邮件</option>
                <option value={2}>跟进 1</option>
                <option value={3}>跟进 2</option>
              </select>
            )}
            {field("语言",
              <select value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} className={inputCls}>
                <option value="en">英语</option>
                <option value="de">德语</option>
                <option value="nl">荷兰语</option>
                <option value="fr">法语</option>
              </select>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">启用（可在活动中使用）</span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
