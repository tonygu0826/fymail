import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

export function EmptyState({ title, description, icon, actions }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-theme-border bg-theme-card-muted/80 p-8 text-center">
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <h3 className="text-lg font-semibold text-theme-heading">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-theme-body">{description}</p>
      {actions && <div className="mt-6">{actions}</div>}
    </div>
  );
}
