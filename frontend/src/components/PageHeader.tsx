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
    <header className="flex flex-col gap-4 border-b border-ink/10 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub max-w-xl">{subtitle}</p>}
        {meta && <div className="text-xs text-ink/60">{meta}</div>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div>
      )}
    </header>
  );
}
