import { cn } from "@/lib/utils";

type FlashMessageProps = {
  message: string;
  tone?: "success" | "error";
};

export function FlashMessage({ message, tone = "success" }: FlashMessageProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-medium shadow-panel",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      {message}
    </div>
  );
}
