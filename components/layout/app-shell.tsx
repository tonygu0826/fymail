"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, HeartPulse, Mail, Megaphone, MessageCircle, Search, Settings2, Users, Clock, RefreshCw, Globe, TrendingUp, Menu, X, LogOut } from "lucide-react";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "仪表板", icon: BarChart3 },
  { href: "/intelligence", label: "市场情报", icon: Search },
  { href: "/deep-search", label: "深度搜索", icon: Globe },
  { href: "/contacts", label: "联系人", icon: Users },
  { href: "/templates", label: "模板", icon: Mail },
  { href: "/campaigns", label: "营销活动", icon: Megaphone },
  { href: "/approvals", label: "审批", icon: Clock },
  { href: "/automation", label: "自动化", icon: RefreshCw },
  { href: "/seo-dashboard", label: "SEO 监控", icon: TrendingUp },
  { href: "/chat", label: "AI 助手", icon: MessageCircle },
  { href: "/settings", label: "设置", icon: Settings2 },
  { href: "/status", label: "状态", icon: HeartPulse },
];

function SidebarContent({ pathname, onNavigate, onLogout }: { pathname: string | null; onNavigate?: () => void; onLogout: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-intelligence-accent-light">FYWarehouse</p>
        <h1 className="text-3xl font-semibold tracking-tight">FyMail</h1>
        <p className="text-sm leading-6 text-slate-300">
          欧洲至加拿大拼箱独立外拓控制室
        </p>
      </div>

      <nav className="mt-10 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                active
                  ? "bg-white text-theme-heading"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }, [router]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
      {/* Mobile hamburger button */}
      <button
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-theme-heading text-white shadow-panel lg:hidden"
        onClick={() => setDrawerOpen(true)}
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col transform rounded-r-3xl border-r border-slate-700 bg-theme-heading px-6 py-7 text-white shadow-panel transition-transform duration-300 ease-in-out lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex justify-end">
          <button
            onClick={closeDrawer}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent pathname={pathname} onNavigate={closeDrawer} onLogout={handleLogout} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 rounded-3xl border border-slate-700 bg-theme-heading px-6 py-7 text-white shadow-panel lg:flex lg:flex-col">
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      <main className="flex-1 pt-14 lg:pt-0">
        <div className="mb-6 rounded-3xl border border-theme-border bg-theme-card/95 px-5 py-4 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-intelligence-accent">
                外拓最小可行产品
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-theme-heading">
                mail.fywarehouse.com
              </h2>
            </div>
            <div className="rounded-2xl border border-theme-border bg-theme-card-muted px-4 py-3 text-sm text-theme-secondary">
              当前范围：可操作的本地MVP，包含模板、联系人、营销活动草稿和状态检查。
            </div>
          </div>
        </div>

        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
