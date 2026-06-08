"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Smart Reader" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/graph", label: "Word Graph" },
  { href: "/daily", label: "Daily Game" },
];

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  return (
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
  );
}
