"use client";

import { useTransition } from "react";

export function DeleteContactButton({ contactId, action }: { contactId: string; action: (formData: FormData) => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm("确认删除此联系人？")) return;

    const formData = new FormData();
    formData.set("contactId", contactId);

    startTransition(() => {
      action(formData);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 text-xs"
    >
      {isPending ? "删除中..." : "删除"}
    </button>
  );
}
