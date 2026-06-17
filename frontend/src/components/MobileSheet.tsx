"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
};

/** Full-width bottom sheet for panels on small screens (hidden at lg+). */
export function MobileSheet({ open, onClose, children, label = "Panel" }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-label={`Close ${label}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-xl border-t border-ink/10 bg-paper p-4 shadow-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {children}
      </div>
    </div>
  );
}
