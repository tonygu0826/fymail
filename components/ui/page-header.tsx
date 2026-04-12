type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="rounded-3xl border border-theme-border bg-theme-card/98 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-intelligence-accent">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-theme-heading">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-theme-body">{description}</p>
        </div>
        {actions ? <div className="flex gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
