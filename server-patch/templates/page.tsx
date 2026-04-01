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
        <Panel title="模板列表" description={`来源：${templates.source}`}>
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
              description="在下方创建第一个外发模板。"
            />
          )}
        </Panel>

        {/* === 创建模板 === */}
        <Panel
          title="创建模板"
          description="填写邮件主题、正文内容和签名，按邮件实际位置排列。"
        >
          <form id="create-template" action={createTemplateAction} className="overflow-hidden rounded-2xl border border-theme-border">
            {/* 主题 - 邮件最顶部 */}
            <div className="border-b border-theme-border bg-theme-card-muted px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm font-medium text-theme-secondary">主题</span>
                <input
                  name="subject"
                  className="flex-1 bg-transparent text-sm text-theme-heading outline-none placeholder:text-theme-secondary/50"
                  placeholder="输入邮件主题，如：Reliable LCL to Canada for {{companyName}}"
                  required
                />
              </div>
            </div>

            {/* 正文内容 - 邮件中间 */}
            <div className="px-5 py-4">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium text-theme-secondary">正文内容</span>
                <textarea
                  name="bodyHtml"
                  className="min-h-[240px] w-full rounded-xl border border-theme-border bg-theme-card px-4 py-3 text-sm leading-relaxed placeholder:text-theme-secondary/50"
                  placeholder={"Dear {{contactName}},\n\nI hope this message finds you well.\n\nI am reaching out to explore potential partnership opportunities between our companies..."}
                  required
                />
              </label>
            </div>

            {/* 邮件签名 - 邮件底部 */}
            <div className="border-t border-dashed border-theme-border/60 px-5 py-4">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium text-theme-secondary">邮件签名</span>
                <textarea
                  name="bodyText"
                  className="min-h-[120px] w-full rounded-xl border border-theme-border bg-theme-card-muted px-4 py-3 text-sm leading-relaxed placeholder:text-theme-secondary/50"
                  placeholder={"Best regards,\nYour Name\nYour Title | Company Name\nPhone: +xx xxx xxxx\nEmail: your@email.com"}
                />
              </label>
            </div>

            {/* 隐藏的默认值 */}
            <input type="hidden" name="language" value="EN" />
            <input type="hidden" name="status" value="DRAFT" />
            <input type="hidden" name="variables" value="companyName, contactName, countryCode" />
            <input type="hidden" name="notes" value="" />

            {/* 提交按钮 */}
            <div className="flex justify-end border-t border-theme-border bg-theme-card-muted/50 px-5 py-3">
              <button className="inline-flex items-center justify-center rounded-2xl bg-theme-button px-5 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover">
                保存模板
              </button>
            </div>
          </form>
        </Panel>
      </section>
    </>
  );
}
