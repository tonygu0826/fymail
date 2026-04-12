"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, Filter, X } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "NEW", label: "新建" },
  { value: "READY", label: "就绪" },
  { value: "CONTACTED", label: "已联系" },
  { value: "REPLIED", label: "已回复" },
  { value: "BOUNCED", label: "退信" },
  { value: "UNSUBSCRIBED", label: "退订" },
];

export function ContactsToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams?.get("search") ?? "";
  const currentPageSize = Number(searchParams?.get("pageSize")) || 20;
  const currentStatus = searchParams?.get("status") ?? "";
  const currentDateFrom = searchParams?.get("dateFrom") ?? "";
  const currentDateTo = searchParams?.get("dateTo") ?? "";

  const [searchValue, setSearchValue] = useState(currentSearch);
  const [showFilters, setShowFilters] = useState(
    !!(currentStatus || currentDateFrom || currentDateTo)
  );

  const hasFilters = !!(currentStatus || currentDateFrom || currentDateTo);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.push(`/contacts?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchValue || null, page: null });
  };

  const handleClearAll = () => {
    setSearchValue("");
    updateParams({ search: null, status: null, dateFrom: null, dateTo: null, page: null });
  };

  return (
    <div className="space-y-3">
      {/* 第一行：搜索 + 筛选按钮 + 每页 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-secondary" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="搜索公司、联系人、邮箱、国家..."
              className="w-full rounded-2xl border border-theme-border bg-theme-card py-2.5 pl-9 pr-4 text-sm text-theme-heading placeholder:text-theme-secondary/50 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-theme-button px-4 py-2.5 text-sm font-semibold text-white hover:bg-theme-button-hover disabled:opacity-50"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              hasFilters
                ? "border-teal-500 bg-teal-50 text-teal-700"
                : "border-theme-border text-theme-secondary hover:bg-theme-card-muted"
            }`}
          >
            <Filter className="h-4 w-4" />
            筛选
            {hasFilters && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-xs text-white">
                {[currentStatus, currentDateFrom, currentDateTo].filter(Boolean).length}
              </span>
            )}
          </button>
          {(currentSearch || hasFilters) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 rounded-2xl border border-theme-border px-3 py-2.5 text-sm font-semibold text-theme-secondary hover:bg-theme-card-muted"
            >
              <X className="h-3.5 w-3.5" />
              清除
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <span>每页</span>
          <select
            value={currentPageSize}
            onChange={(e) => updateParams({ pageSize: e.target.value, page: null })}
            className="rounded-xl border border-theme-border bg-theme-card px-2 py-1.5 text-sm text-theme-heading"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>条</span>
        </div>
      </div>

      {/* 第二行：筛选面板（展开时显示） */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-theme-border bg-theme-card-muted/50 p-4">
          {/* 状态筛选 */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-theme-secondary">状态</span>
            <select
              value={currentStatus}
              onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
              className="rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-heading"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {/* 添加时间 - 从 */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-theme-secondary">添加时间从</span>
            <input
              type="date"
              value={currentDateFrom}
              onChange={(e) => updateParams({ dateFrom: e.target.value || null, page: null })}
              className="rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-heading"
            />
          </label>

          {/* 添加时间 - 到 */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-theme-secondary">添加时间到</span>
            <input
              type="date"
              value={currentDateTo}
              onChange={(e) => updateParams({ dateTo: e.target.value || null, page: null })}
              className="rounded-xl border border-theme-border bg-theme-card px-3 py-2 text-sm text-theme-heading"
            />
          </label>
        </div>
      )}
    </div>
  );
}
