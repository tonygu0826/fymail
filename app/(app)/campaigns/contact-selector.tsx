"use client";

import { useMemo, useState } from "react";
import { Search, Filter, Users } from "lucide-react";

type Contact = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string;
  status: string;
  countryCode?: string | null;
  createdAt?: string | Date | null;
};

type ContactSelectorProps = {
  contacts: Contact[];
  disabled?: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "NEW", label: "新建" },
  { value: "READY", label: "就绪" },
  { value: "CONTACTED", label: "已联系" },
  { value: "REPLIED", label: "已回复" },
  { value: "BOUNCED", label: "退信" },
  { value: "UNSUBSCRIBED", label: "退订" },
];

const DATE_PRESETS = [
  { value: "", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "older", label: "30 天前" },
];

export function ContactSelector({ contacts, disabled }: ContactSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  // 获取唯一国家列表
  const countries = useMemo(() => {
    const set = new Set(contacts.map(c => c.countryCode || '').filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  // 筛选联系人
  const filtered = useMemo(() => {
    const now = new Date();
    return contacts.filter(c => {
      // 搜索
      if (search) {
        const q = search.toLowerCase();
        const match = c.companyName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.contactName?.toLowerCase().includes(q)) ||
          (c.countryCode?.toLowerCase().includes(q));
        if (!match) return false;
      }
      // 状态
      if (statusFilter && c.status !== statusFilter) return false;
      // 国家
      if (countryFilter && c.countryCode !== countryFilter) return false;
      // 日期
      if (dateFilter && c.createdAt) {
        const created = new Date(c.createdAt);
        const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === "today" && diffDays > 1) return false;
        if (dateFilter === "7d" && diffDays > 7) return false;
        if (dateFilter === "30d" && diffDays > 30) return false;
        if (dateFilter === "older" && diffDays <= 30) return false;
      }
      return true;
    });
  }, [contacts, search, statusFilter, dateFilter, countryFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggleFiltered = () => {
    if (allFilteredSelected) {
      // 取消选中所有筛选后的
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      // 选中所有筛选后的
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.id));
        return next;
      });
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

  const clearSelection = () => setSelected(new Set());

  // 统计
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [contacts]);

  return (
    <div className="space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-theme-body">选择联系人 *</span>
        <span className="text-xs text-theme-secondary">
          已选 <span className="font-semibold text-teal-600">{selected.size}</span> / {contacts.length} 总计
        </span>
      </div>

      {/* 快捷统计 */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([st, cnt]) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(statusFilter === st ? "" : st)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === st
                ? "bg-teal-100 text-teal-700 ring-1 ring-teal-400"
                : "bg-theme-card-muted text-theme-secondary hover:bg-theme-card-muted/80"
            }`}
          >
            {st} ({cnt})
          </button>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索..."
            className="w-full rounded-xl border border-theme-border bg-theme-card py-2 pl-8 pr-3 text-xs text-theme-heading placeholder:text-theme-secondary/50"
          />
        </div>

        {/* 时间筛选 */}
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="rounded-xl border border-theme-border bg-theme-card px-2.5 py-2 text-xs text-theme-heading"
        >
          {DATE_PRESETS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* 国家筛选 */}
        <select
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          className="rounded-xl border border-theme-border bg-theme-card px-2.5 py-2 text-xs text-theme-heading"
        >
          <option value="">全部国家</option>
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleFiltered}
          disabled={disabled || filtered.length === 0}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-50"
        >
          <Users className="h-3.5 w-3.5" />
          {allFilteredSelected ? "取消选中筛选结果" : `选中筛选结果 (${filtered.length})`}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-semibold text-red-500 hover:text-red-600"
          >
            清空已选
          </button>
        )}
        <span className="text-xs text-theme-secondary">
          筛选显示 {filtered.length} / {contacts.length}
        </span>
      </div>

      {/* 联系人列表 */}
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-theme-border bg-theme-card-muted p-3">
        {filtered.length > 0 ? (
          filtered.map(contact => (
            <label
              key={contact.id}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm cursor-pointer transition-colors ${
                selected.has(contact.id)
                  ? "border-teal-400 bg-teal-50/50"
                  : "border-theme-border bg-theme-card hover:bg-theme-card-muted/50"
              }`}
            >
              <input
                type="checkbox"
                name="contactIds"
                value={contact.id}
                checked={selected.has(contact.id)}
                onChange={() => toggleOne(contact.id)}
                className="mt-1"
                disabled={disabled}
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-theme-heading truncate">{contact.companyName}</span>
                  <span className="shrink-0 rounded-full bg-theme-card-muted px-2 py-0.5 text-[10px] font-medium text-theme-secondary">
                    {contact.status}
                  </span>
                  {contact.countryCode && (
                    <span className="shrink-0 text-[10px] text-theme-secondary">
                      {contact.countryCode}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-theme-secondary truncate">
                  {[contact.contactName, contact.email].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-theme-secondary">
            {contacts.length === 0 ? "请先在联系人管理中添加联系人。" : "无匹配的联系人，请调整筛选条件。"}
          </p>
        )}
      </div>
    </div>
  );
}
