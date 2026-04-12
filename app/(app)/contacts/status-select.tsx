"use client";

import { useTransition } from "react";
import { updateContactStatusAction } from "./actions";

const STATUSES = ["NEW", "READY", "CONTACTED", "REPLIED", "BOUNCED", "UNSUBSCRIBED"];

type StatusSelectProps = {
  contactId: string;
  currentStatus: string;
};

export function StatusSelect({ contactId, currentStatus }: StatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    startTransition(async () => {
      await updateContactStatusAction(contactId, newStatus);
    });
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-lg border border-theme-border bg-theme-card px-2 py-1 text-xs font-medium text-theme-heading disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
