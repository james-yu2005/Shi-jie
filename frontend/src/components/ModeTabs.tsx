"use client";

export type ModeTab<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

/** Primary/outline button row used to switch between page modes. */
export function ModeTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ModeTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="-mx-1 flex overflow-x-auto pb-1">
      <div className="flex min-w-0 gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`shrink-0 ${active === t.id ? "btn-primary" : "btn-outline"}`}
            onClick={() => onChange(t.id)}
            disabled={t.disabled}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
