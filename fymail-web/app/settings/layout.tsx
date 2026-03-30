"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils/cn";

const SETTINGS_TABS = [
  { href: "/settings/email", label: "邮件账号" },
  { href: "/settings/sending", label: "发送策略" },
  { href: "/settings/users", label: "用户管理" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell>
      {/* Settings sub-nav */}
      <div className="flex border-b border-border mb-6 -mt-2">
        {SETTINGS_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
              pathname === tab.href
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </AppShell>
  );
}
