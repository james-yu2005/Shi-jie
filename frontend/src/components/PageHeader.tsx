import { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
};

/**
 * Shared page header: large title, optional subtitle, optional inline
 * meta (e.g. "12 nodes · 24 edges") and a right-aligned actions slot.
 */
export function PageHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
      <div className="space-y-1">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub max-w-xl">{subtitle}</p>}
        {meta && <div className="text-xs text-ink/60">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
