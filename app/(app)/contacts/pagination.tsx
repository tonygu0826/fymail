"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  total: number;
  page: number;
  pageSize: number;
};

export function Pagination({ total, page, pageSize }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (newPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    startTransition(() => {
      router.push(`/contacts?${params.toString()}`);
    });
  };

  // Generate page numbers to display
  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-theme-secondary">
        共 <span className="font-semibold text-theme-heading">{total}</span> 条，
        显示第 {start}-{end} 条
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || isPending}
          className="inline-flex items-center justify-center rounded-xl border border-theme-border p-2 text-theme-secondary hover:bg-theme-card-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 text-sm text-theme-secondary">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goToPage(p)}
              disabled={isPending}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                p === page
                  ? "bg-theme-button text-white"
                  : "border border-theme-border text-theme-secondary hover:bg-theme-card-muted"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages || isPending}
          className="inline-flex items-center justify-center rounded-xl border border-theme-border p-2 text-theme-secondary hover:bg-theme-card-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
