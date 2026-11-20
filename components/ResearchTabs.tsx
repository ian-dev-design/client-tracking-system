"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/research", label: "Board" },
  { href: "/research/library", label: "Interview library" },
  { href: "/research/themes", label: "Themes" },
  { href: "/research/quotes", label: "Quotes wall" },
  { href: "/research/participants", label: "Participants" },
];

export function ResearchTabs() {
  const path = usePathname();
  return (
    <div className="mb-6 flex gap-6 overflow-x-auto whitespace-nowrap border-b border-line">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={`-mb-px shrink-0 border-b-2 py-2.5 text-sm ${path === t.href ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
