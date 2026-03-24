import { headers } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "/dashboard";

  return <AppShell pathname={pathname}>{children}</AppShell>;
}
