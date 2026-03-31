"use client";

import { useTransition } from "react";

export function DeleteButton({ templateId, action }: { templateId: string; action: (formData: FormData) => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm("确认删除此模板？")) return;

    const formData = new FormData();
    formData.set("templateId", templateId);

    startTransition(() => {
      action(formData);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {isPending ? "删除中..." : "删除"}
    </button>
  );
}
