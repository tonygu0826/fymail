"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { LogOut, ChevronLeft } from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  pendingApprovals?: number;
}

export function Sidebar({ pendingApprovals = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-white font-semibold text-[15px] tracking-tight">
            FY<span className="text-blue-400">Mail</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-sidebar-accent transition-colors ml-auto"
        >
          <ChevronLeft
            className={cn(
              "w-4 h-4 text-sidebar-foreground/60 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV_ITEMS.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                const badge =
                  item.badgeKey === "pendingApprovals"
                    ? pendingApprovals
                    : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2 rounded-md text-[13.5px] transition-colors relative group",
                        isActive
                          ? "bg-sidebar-accent text-white"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
                      )}
                      <Icon
                        className={cn(
                          "shrink-0 w-4 h-4",
                          isActive
                            ? "text-blue-400"
                            : "text-sidebar-foreground/60 group-hover:text-white/80"
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 font-medium">
                            {item.label}
                          </span>
                          {badge > 0 && (
                            <span className="flex items-center justify-center w-5 h-5 text-[10px] font-semibold bg-blue-500 text-white rounded-full">
                              {badge > 9 ? "9+" : badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            TG
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white truncate">
                  Tony G
                </p>
                <p className="text-[11px] text-sidebar-foreground/50 truncate">
                  管理员
                </p>
              </div>
              <button className="p-1 rounded hover:bg-sidebar-accent transition-colors">
                <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/50" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
