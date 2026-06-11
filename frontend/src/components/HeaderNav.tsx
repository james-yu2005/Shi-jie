"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LearningSettings } from "./LearningSettings";

const LINKS = [
  { href: "/", label: "Smart Reader" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/graph", label: "Knowledge Graph" },
  { href: "/daily", label: "Daily Game" },
];

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav className="flex items-center gap-1 text-sm">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              data-active={active ? "true" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <LearningSettings />
    </div>
  );
}
