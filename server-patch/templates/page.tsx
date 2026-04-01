import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getTemplates, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createTemplateAction, deleteTemplateAction } from "@/app/(app)/templates/actions";
import { DeleteButton } from "@/app/(app)/templates/delete-button";
import TemplateCreator from "@/app/(app)/templates/template-creator";

type TemplatesPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const templates = await getTemplates();

  return (
    <>
      <PageHeader
        eyebrow="模板"
        title="模板管理"
        description="创建、审阅和编辑基于Prisma的外发模板。MVP保持编辑简洁耐用。"
        actions={
          <a
            href="#create-template"
            className="inline-flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm font-semibold text-theme-heading hover:bg-theme-card-muted"
          >
            <Plus className="h-4 w-4" />
            新建模板
          </a>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      {/* === 模板列表 === */}
      <section className="space-y-6">
        <Panel title="模板列表" description={`共 ${templates.items.length} 个模板`}>
          {templates.items.length > 0 ? (
            <div className="space-y-4">
              {templates.items.map((template) => (
                <div key={template.id} className="rounded-2xl border border-theme-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-theme-heading">{template.name}</h3>
                      <p className="mt-1 text-sm text-theme-secondary">
                        {template.subject} · {template.language}
                      </p>
                    </div>
                    <StatusPill status={template.status} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-theme-secondary">
                    更新于 {formatDate(template.updatedAt)}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm text-theme-secondary">
                    <span className="font-mono text-xs uppercase tracking-[0.16em]">{template.slug}</span>
                    <div className="flex items-center gap-3">
                      <Link href={`/templates/${template.id}`} className="font-semibold text-teal-700 hover:text-teal-800">
                        编辑
                      </Link>
                      <DeleteButton templateId={template.id} action={deleteTemplateAction} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无模板"
              description="在下方选择预设模板样式创建。"
            />
          )}
        </Panel>

        {/* === 创建模板 === */}
        <div id="create-template" />
        <Panel
          title="创建模板"
          description="选择预设商务邮件模板，自动匹配格式和换行，可预览邮件样式。"
        >
          <TemplateCreator createAction={createTemplateAction} />
        </Panel>
      </section>
    </>
  );
}
