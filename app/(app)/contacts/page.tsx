import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getContacts, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createContactAction } from "@/app/(app)/contacts/actions";
import { ContactsToolbar } from "@/app/(app)/contacts/contacts-toolbar";
import { ContactsTable } from "@/app/(app)/contacts/contacts-table";
import { Pagination } from "@/app/(app)/contacts/pagination";

type ContactsPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
    search?: string;
    page?: string;
    pageSize?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const search = searchParams?.search ?? "";
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const pageSize = Number(searchParams?.pageSize) || 20;
  const status = searchParams?.status || undefined;
  const dateFrom = searchParams?.dateFrom || undefined;
  const dateTo = searchParams?.dateTo || undefined;

  const contacts = await getContacts({ orderBy: "priority", search: search || undefined, page, pageSize, status, dateFrom, dateTo });
  const isDatabase = contacts.source === "database";

  return (
    <>
      <PageHeader
        eyebrow="联系人"
        title="联系人管理"
        description="管理所有潜在客户联系人，支持添加、编辑和删除操作。"
        actions={
          <a
            href="#create-contact"
            className="inline-flex items-center gap-2 rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover"
          >
            <UserPlus className="h-4 w-4" />
            添加联系人
          </a>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} /> : null}
      {searchParams?.error ? <FlashMessage tone="error" message={searchParams.error} /> : null}

      {/* === 所有联系人列表 === */}
      <section className="space-y-6">
        <Panel title="所有联系人" description={isDatabase ? `共 ${contacts.total} 位联系人` : "数据库未配置，暂无真实联系人"}>
          {/* 搜索和分页工具栏 */}
          {isDatabase && (
            <div className="mb-4">
              <ContactsToolbar />
            </div>
          )}

          {/* 搜索提示 */}
          {search && isDatabase && (
            <p className="mb-3 text-sm text-theme-secondary">
              搜索 &ldquo;<span className="font-semibold text-theme-heading">{search}</span>&rdquo;
              的结果：找到 {contacts.total} 条
            </p>
          )}

          {contacts.items.length > 0 && isDatabase ? (
            <>
              <ContactsTable contacts={contacts.items as any} />

              {/* 分页 */}
              <div className="mt-4">
                <Pagination total={contacts.total} page={contacts.page} pageSize={contacts.pageSize} />
              </div>
            </>
          ) : (
            <EmptyState
              title={search ? "未找到匹配的联系人" : "暂无联系人"}
              description={search ? "尝试使用其他关键词搜索。" : "在下方添加第一个联系人到数据库。"}
            />
          )}
        </Panel>

        {/* === 添加联系人 === */}
        <Panel title="添加联系人" description="填写联系人信息，添加到潜在客户列表。">
          <form id="create-contact" action={createContactAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">公司名称 *</span>
                <input
                  name="companyName"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="Forwarder GmbH"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">联系人姓名</span>
                <input
                  name="contactName"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="Anna Meyer"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">邮箱 *</span>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="anna@forwarder.example"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">国家代码 *</span>
                <input
                  name="countryCode"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3 uppercase"
                  placeholder="DE"
                  required
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">职位</span>
                <input
                  name="jobTitle"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="Sales Manager"
                />
              </label>
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">状态</span>
                <select
                  name="status"
                  defaultValue="NEW"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                >
                  {mvpOptions.contactStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">市场区域</span>
                <input
                  name="marketRegion"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="DACH"
                />
              </label>
              <label className="block space-y-2 text-sm text-theme-body">
                <span className="font-medium">来源</span>
                <input
                  name="source"
                  className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                  placeholder="manual-entry"
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm text-theme-body">
              <span className="font-medium">标签</span>
              <input
                name="tags"
                className="w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                placeholder="germany, lcl"
              />
            </label>
            <label className="block space-y-2 text-sm text-theme-body">
              <span className="font-medium">备注</span>
              <textarea
                name="notes"
                className="min-h-20 w-full rounded-2xl border border-theme-border bg-theme-card px-4 py-3"
                placeholder="补充信息"
              />
            </label>
            <button className="inline-flex items-center justify-center rounded-2xl bg-theme-button px-4 py-3 text-sm font-semibold text-white hover:bg-theme-button-hover">
              保存联系人
            </button>
          </form>
        </Panel>
      </section>
    </>
  );
}
