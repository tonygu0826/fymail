"use client";

import { useState } from "react";
import { Play, Trash2 } from "lucide-react";

type CampaignActionsProps = {
  campaignId: string;
  status: string;
  contactCount: number;
  executeAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function CampaignActions({ campaignId, status, contactCount, executeAction, deleteAction }: CampaignActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmExecute, setConfirmExecute] = useState(false);

  const canExecute = status === "DRAFT" && contactCount > 0;

  return (
    <div className="flex items-center gap-2">
      {canExecute && !confirmExecute && (
        <button
          type="button"
          onClick={() => setConfirmExecute(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
        >
          <Play className="h-3.5 w-3.5" />
          提交审批
        </button>
      )}

      {confirmExecute && (
        <form action={executeAction} className="flex items-center gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <span className="text-xs text-amber-600 font-medium">提交 {contactCount} 封邮件到审批？</span>
          <button
            type="submit"
            className="rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
          >
            确认
          </button>
          <button
            type="button"
            onClick={() => setConfirmExecute(false)}
            className="rounded-xl border border-theme-border px-3 py-1.5 text-xs font-semibold text-theme-secondary hover:bg-theme-card-muted"
          >
            取消
          </button>
        </form>
      )}

      {!confirmDelete && !confirmExecute && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </button>
      )}

      {confirmDelete && (
        <form action={deleteAction} className="flex items-center gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <span className="text-xs text-red-600 font-medium">确认删除？</span>
          <button
            type="submit"
            className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            删除
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-xl border border-theme-border px-3 py-1.5 text-xs font-semibold text-theme-secondary hover:bg-theme-card-muted"
          >
            取消
          </button>
        </form>
      )}
    </div>
  );
}
