"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, ChevronDown } from "lucide-react";

import { StatusSelect } from "./status-select";
import { DeleteContactButton } from "./delete-button";
import { bulkUpdateStatusAction, deleteContactAction } from "./actions";
import { formatDate } from "@/lib/utils";

type Contact = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string;
  countryCode: string;
  status: string;
  createdAt: Date;
};

const STATUS_OPTIONS = [
  { value: "NEW", label: "新建" },
  { value: "READY", label: "就绪" },
  { value: "CONTACTED", label: "已联系" },
  { value: "REPLIED", label: "已回复" },
  { value: "BOUNCED", label: "退信" },
  { value: "UNSUBSCRIBED", label: "退订" },
];

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = (newStatus: string) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkUpdateStatusAction(ids, newStatus);
      if (result.success) {
        setMessage({ type: "success", text: `已将 ${result.count} 个联系人状态更新为 ${newStatus}` });
        setSelected(new Set());
      } else {
        setMessage({ type: "error", text: result.error || "更新失败" });
      }
      setTimeout(() => setMessage(null), 3000);
    });
  };

  return (
    <div>
      {/* 批量操作栏 */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
          <span className="text-sm font-semibold text-teal-700">
            已选 {selected.size} 个联系人
          </span>
          <span className="text-sm text-teal-600">批量修改状态：</span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={isPending}
                onClick={() => handleBulkStatus(opt.value)}
                className="rounded-full border border-teal-300 bg-white px-3 py-1 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-medium text-teal-500 hover:text-teal-700"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 提示消息 */}
      {message && (
        <div className={`mb-3 rounded-2xl px-4 py-3 text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-hidden rounded-3xl border border-theme-border">
        <table className="min-w-full divide-y divide-theme-border text-sm">
          <thead className="bg-theme-card-muted">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-theme-secondary">
              <th className="px-3 py-3 w-10">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center text-theme-secondary hover:text-theme-heading"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-teal-600" />
                  ) : someSelected ? (
                    <div className="relative">
                      <Square className="h-4 w-4" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-sm bg-teal-500" />
                      </div>
                    </div>
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
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
            {contacts.map(contact => (
              <tr
                key={contact.id}
                className={`transition-colors ${
                  selected.has(contact.id) ? "bg-teal-50/50" : "hover:bg-theme-card-muted/50"
                }`}
              >
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleOne(contact.id)}
                    className="flex items-center"
                  >
                    {selected.has(contact.id) ? (
                      <CheckSquare className="h-4 w-4 text-teal-600" />
                    ) : (
                      <Square className="h-4 w-4 text-theme-secondary" />
                    )}
                  </button>
                </td>
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
                  <StatusSelect contactId={contact.id} currentStatus={contact.status} />
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
    </div>
  );
}
