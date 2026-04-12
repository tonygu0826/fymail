import { cn } from "@/lib/utils";

const styles = {
  ACTIVE: "bg-teal-100 text-teal-800",
  DRAFT: "bg-slate-100 text-slate-700",
  ARCHIVED: "bg-slate-200 text-slate-700",
  READY: "bg-emerald-100 text-emerald-800",
  NEW: "bg-sky-100 text-sky-800",
  CONTACTED: "bg-indigo-100 text-indigo-800",
  REPLIED: "bg-amber-100 text-amber-800",
  BOUNCED: "bg-rose-100 text-rose-800",
  UNSUBSCRIBED: "bg-rose-100 text-rose-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  RUNNING: "bg-amber-100 text-amber-800",
  PAUSED: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  SENT: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
};

type StatusPillProps = {
  status: string;
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        styles[status as keyof typeof styles] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {status}
    </span>
  );
}
