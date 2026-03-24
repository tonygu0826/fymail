import { cn } from "@/lib/utils";

type PanelProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Panel({ title, description, children, className }: PanelProps) {
  return (
    <section className={cn("rounded-3xl border border-white/70 bg-white/90 p-6 shadow-panel", className)}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
