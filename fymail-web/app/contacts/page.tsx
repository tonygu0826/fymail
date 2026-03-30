"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Search, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contactsApi, Contact, ListContactsParams } from "@/lib/api/contacts";
import { PageHeader } from "@/components/layout/page-header";
import { ContactStatusBadge, ScoreStars } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ContactDrawer } from "@/components/contacts/contact-drawer";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "cold", label: "待开发" },
  { value: "warm", label: "跟进中" },
  { value: "active", label: "活跃" },
  { value: "do_not_contact", label: "不联系" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "全部国家" },
  { value: "DE", label: "德国" },
  { value: "NL", label: "荷兰" },
  { value: "GB", label: "英国" },
  { value: "FR", label: "法国" },
  { value: "BE", label: "比利时" },
  { value: "CA", label: "加拿大" },
  { value: "US", label: "美国" },
];

export default function ContactsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const params: ListContactsParams = {
    page, limit: 25,
    search: search || undefined,
    status: status || undefined,
    country: country || undefined,
    sortBy: "createdAt", sortOrder: "desc",
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["contacts", params],
    queryFn: () => contactsApi.list(params),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setSelectedIds(new Set()); },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<Contact> }) =>
      contactsApi.bulkUpdate(ids, updates),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setSelectedIds(new Set()); },
  });

  const contacts = data?.data ?? [];
  const meta = data?.meta;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === contacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map((c) => c.id)));
  }, [contacts, selectedIds.size]);

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0;

  return (
    <>
      <PageHeader
        title="联系人"
        description={meta ? `共 ${meta.total.toLocaleString()} 个联系人` : "联系人池管理"}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/contacts/import")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors">
              <Upload className="w-3.5 h-3.5" />
              导入CSV
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              新增联系人
            </button>
          </div>
        }
      />

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="搜索姓名、邮箱、职位..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring">
          {COUNTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ["contacts"] })}
          className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors">
          <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* 批量操作栏 */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
          <span className="text-sm font-medium text-primary">已选择 {selectedIds.size} 个</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {(["warm", "active", "cold"] as const).map((s) => (
              <button key={s} onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), updates: { status: s } })}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-accent transition-colors">
                标记为{s === "warm" ? "跟进中" : s === "active" ? "活跃" : "待开发"}
              </button>
            ))}
            <button onClick={() => { if (confirm(`确认删除 ${selectedIds.size} 个联系人？此操作不可撤销。`)) Array.from(selectedIds).forEach((id) => deleteMutation.mutate(id)); }}
              className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              删除
            </button>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-3 py-2.5 text-left">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-border" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">联系人</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">公司</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">国家</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">状态</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">评分</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">标签</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">添加时间</th>
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3.5 bg-muted rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : contacts.length === 0 ? (
                <tr><td colSpan={9}>
                  <EmptyState title="暂无联系人" description="导入CSV或手动添加联系人来开始拓客" />
                </td></tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id}
                    className={cn("table-row-hover", selectedIds.has(contact.id) && "bg-primary/5")}
                    onClick={() => setDrawerContactId(contact.id)}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-border" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {(contact.firstName?.[0] ?? contact.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-foreground truncate max-w-[140px] block">{contact.companyName || contact.jobTitle || "—"}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{contact.country || "—"}</td>
                    <td className="px-3 py-2.5"><ContactStatusBadge status={contact.status} /></td>
                    <td className="px-3 py-2.5"><ScoreStars score={contact.score ?? 3} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(contact.tags ?? []).slice(0, 2).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">{tag}</span>
                        ))}
                        {(contact.tags?.length ?? 0) > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{(contact.tags?.length ?? 0) - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(contact.createdAt), "MM月dd日 yyyy")}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              显示 {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} 条，共 {meta.total.toLocaleString()} 条
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                上一页
              </button>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(meta.totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={cn("w-7 h-7 text-xs border rounded transition-colors",
                      p === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      <ContactDrawer contactId={drawerContactId} onClose={() => setDrawerContactId(null)}
        onDeleted={() => { setDrawerContactId(null); queryClient.invalidateQueries({ queryKey: ["contacts"] }); }} />
      <ContactFormModal open={showCreateModal} onClose={() => setShowCreateModal(false)}
        onSaved={() => { setShowCreateModal(false); queryClient.invalidateQueries({ queryKey: ["contacts"] }); }} />
    </>
  );
}
