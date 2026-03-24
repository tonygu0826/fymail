import Link from "next/link";
import { BarChart3, HeartPulse, Mail, Megaphone, Settings2, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/status", label: "Status", icon: HeartPulse },
];

type AppShellProps = {
  pathname: string;
  children: React.ReactNode;
};

export function AppShell({ pathname, children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
      <aside className="hidden w-72 shrink-0 rounded-3xl border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-panel lg:block">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-teal-200">FYWarehouse</p>
          <h1 className="text-3xl font-semibold tracking-tight">FyMail</h1>
          <p className="text-sm leading-6 text-slate-300">
            Standalone outbound prospecting control room for Europe to Canada LCL.
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
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                  active
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1">
        <div className="mb-6 rounded-3xl border border-white/70 bg-white/90 px-5 py-4 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                Prospecting MVP
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                mail.fywarehouse.com
              </h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Current scope: internal ops shell, health checks, Prisma schema, and route skeletons.
            </div>
          </div>
        </div>

        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
