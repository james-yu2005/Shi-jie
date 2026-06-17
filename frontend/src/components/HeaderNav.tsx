"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LearningSettings } from "./LearningSettings";

const LINKS = [
  { href: "/", label: "Smart Reader", short: "Reader" },
  { href: "/flashcards", label: "Flashcards", short: "Cards" },
  { href: "/graph", label: "Knowledge Graph", short: "Graph" },
  { href: "/daily", label: "Daily Game", short: "Daily" },
] as const;

function NavLinks({
  pathname,
  onNavigate,
  mobile = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={mobile ? "nav-link w-full" : "nav-link"}
            data-active={active ? "true" : undefined}
            onClick={onNavigate}
          >
            {mobile ? l.label : <span className="hidden lg:inline">{l.label}</span>}
            {!mobile && (
              <span className="lg:hidden">{l.short}</span>
            )}
          </Link>
        );
      })}
    </>
  );
}

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <>
      <div className="hidden items-center gap-2 md:flex md:gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <NavLinks pathname={pathname} />
        </nav>
        <LearningSettings />
      </div>

      <button
        type="button"
        className="btn-ghost px-2 md:hidden"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      {menuOpen && (
        <div className="fixed inset-0 top-[53px] z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute left-0 right-0 border-b border-ink/10 bg-paper px-4 py-4 shadow-lg">
            <nav className="flex flex-col gap-1 text-sm">
              <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} mobile />
            </nav>
            <div className="mt-4 border-t border-ink/10 pt-4">
              <LearningSettings />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
