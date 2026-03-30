import { cn } from "@/lib/utils/cn";

type ContactStatus = "cold" | "warm" | "active" | "do_not_contact";
type CampaignStatus = "draft" | "pending_approval" | "approved" | "running" | "paused" | "completed" | "rejected";

const CONTACT_STATUS_CONFIG: Record<ContactStatus, { label: string; className: string }> = {
  cold: { label: "待开发", className: "badge-cold" },
  warm: { label: "跟进中", className: "badge-warm" },
  active: { label: "活跃", className: "badge-active" },
  do_not_contact: { label: "不联系", className: "badge-dnc" },
};

const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "badge-draft" },
  pending_approval: { label: "待审批", className: "badge-pending" },
  approved: { label: "已批准", className: "badge-active" },
  running: { label: "运行中", className: "badge-running" },
  paused: { label: "已暂停", className: "badge-draft" },
  completed: { label: "已完成", className: "badge-completed" },
  rejected: { label: "已拒绝", className: "badge-rejected" },
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const config = CONTACT_STATUS_CONFIG[status] ?? { label: status, className: "badge-cold" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", config.className)}>
      {config.label}
    </span>
  );
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const config = CAMPAIGN_STATUS_CONFIG[status] ?? { label: status, className: "badge-draft" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", config.className)}>
      {config.label}
    </span>
  );
}

export function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn("text-sm", i < score ? "text-amber-400" : "text-gray-200 dark:text-gray-700")}>
          ★
        </span>
      ))}
    </div>
  );
}
