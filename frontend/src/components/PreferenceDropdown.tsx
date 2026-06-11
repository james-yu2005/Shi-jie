"use client";

import { useEffect, useRef, useState } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
};

export function PreferenceDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label className="flex items-center gap-1.5 rounded-md border border-ink/10 px-2 py-1">
        <span className="text-ink/50">{label}</span>
        <button
          type="button"
          className="cursor-pointer bg-transparent font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-1"
          onClick={() => setOpen((v) => !v)}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {selectedLabel}
        </button>
      </label>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border border-ink/15 bg-white p-1 shadow-sm"
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                    selected
                      ? "border-ink/20 bg-paper text-ink"
                      : "border-transparent text-ink/80 hover:bg-ink/5 hover:text-ink"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
