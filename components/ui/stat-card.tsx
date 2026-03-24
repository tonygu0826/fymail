type StatCardProps = {
  label: string;
  value: string | number;
  tone?: "default" | "accent";
  hint?: string;
};

export function StatCard({ label, value, tone = "default", hint }: StatCardProps) {
  return (
    <article
      className={
        tone === "accent"
          ? "rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-panel"
          : "rounded-3xl border border-white/70 bg-white/90 p-5 shadow-panel"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-3 text-sm text-slate-600">{hint}</p> : null}
    </article>
  );
}
