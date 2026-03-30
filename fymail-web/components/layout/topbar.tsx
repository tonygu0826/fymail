"use client";

import { usePathname } from "next/navigation";
import { Bell, HelpCircle } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants/nav";

function getBreadcrumb(pathname: string): string {
  for (const section of NAV_ITEMS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return item.label;
      }
    }
  }
  return "FYMail";
}

function getSubtitle(pathname: string): string | null {
  if (pathname.includes("/contacts/import")) return "CSV 批量导入";
  if (pathname.includes("/contacts/") && pathname !== "/contacts") return "联系人详情";
  if (pathname.includes("/campaigns/new")) return "创建活动";
  if (pathname.includes("/templates/new")) return "新建模板";
  if (pathname.includes("/automation/new")) return "新建规则";
  return null;
}

export function Topbar() {
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);
  const subtitle = getSubtitle(pathname);

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <h1 className="text-[15px] font-semibold text-foreground">
          {breadcrumb}
        </h1>
        {subtitle && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-[14px] text-muted-foreground">{subtitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground relative">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
