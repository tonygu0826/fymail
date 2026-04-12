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
          ? "rounded-3xl border border-intelligence-accent-light bg-intelligence-accent-light/30 p-5 shadow-panel"
          : "rounded-3xl border border-theme-border bg-theme-card/98 p-5 shadow-panel"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-theme-secondary">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-theme-heading">{value}</p>
      {hint ? <p className="mt-3 text-sm text-theme-body">{hint}</p> : null}
    </article>
  );
}
