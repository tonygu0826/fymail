import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FlashMessage } from "@/components/ui/flash-message";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getContacts, mvpOptions } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";
import { createContactAction, deleteContactAction } from "@/app/(app)/contacts/actions";
import { DeleteContactButton } from "@/app/(app)/contacts/delete-button";

type ContactsPageProps = {
  searchParams?: {
    message?: string;
    error?: string;
  };
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const contacts = await getContacts({ orderBy: 'priority' });

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
        <Panel title="所有联系人" description={`共 ${contacts.items.length} 位联系人`}>
          {contacts.items.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-theme-border">
              <table className="min-w-full divide-y divide-theme-border text-sm">
                <thead className="bg-theme-card-muted">
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-theme-secondary">
                    <th className="px-4 py-3">公司</th>
                    <th className="px-4 py-3">联系人</th>
                    <th className="px-4 py-3">邮箱</th>
                    <th className="px-4 py-3">国家</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">创建时间</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border bg-theme-card">
                  {contacts.items.map((contact) => (
                    <tr key={contact.id} className="hover:bg-theme-card-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-theme-heading">{contact.companyName}</div>
                      </td>
                      <td className="px-4 py-3 text-theme-body">
                        {contact.contactName ?? "未知"}
                      </td>
                      <td className="px-4 py-3 text-theme-body">
                        {contact.email}
                      </td>
                      <td className="px-4 py-3 text-theme-body">
                        {contact.countryCode}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={contact.status} />
                      </td>
                      <td className="px-4 py-3 text-theme-body text-xs">
                        {formatDate(contact.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteContactButton contactId={contact.id} action={deleteContactAction} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="暂无联系人"
              description="在下方添加第一个联系人。"
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
