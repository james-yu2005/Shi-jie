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
    <>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? "btn-primary" : "btn-outline"}
          onClick={() => onChange(t.id)}
          disabled={t.disabled}
        >
          {t.label}
        </button>
      ))}
    </>
  );
}
