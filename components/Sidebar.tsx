"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { JOURNEY } from "@/lib/journey";
import { Brand } from "./ui";
import { Bell, type BellItem } from "./Bell";

type Counts = { tasks: number; unmatched: number; drafts: number };

export function Sidebar({ counts, userName, demo, notifications }: { counts: Counts; userName: string; demo: boolean; notifications: BellItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false); // phone menu
  useEffect(() => setOpen(false), [path]); // close after navigating
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const heading = (text: string) => <div className="eyebrow mt-8 mb-2 px-3">{text}</div>;
  const link = (href: string, label: string, badge?: number, alert = false) => (
    <Link key={href} href={href}
      className={`flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
        active(href) ? "bg-forest/[0.07] font-semibold text-forest" : "text-ink hover:bg-wash"}`}>
      <span>{label}</span>
      {!!badge && <span className={`text-xs tabular-nums ${alert ? "font-semibold text-coral" : "text-muted"}`}>{badge}</span>}
    </Link>
  );

  return (
    <aside className="sticky top-0 z-40 flex w-full flex-col border-b border-line bg-side px-3 py-3 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r md:py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="min-w-0 pl-3"><Brand /></Link>
        <div className="ml-auto md:ml-0"><Bell items={notifications} /></div>
        <button className="btn btn-sm ml-2 md:hidden" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
          {open ? "Close" : `Menu${counts.tasks ? ` · ${counts.tasks}` : ""}`}
        </button>
      </div>

      <div id="main-nav" className={`${open ? "flex" : "hidden"} max-h-[calc(100vh-4rem)] flex-col overflow-y-auto pb-3 md:flex md:max-h-none md:flex-1 md:overflow-visible md:pb-0`}>
      <nav className="flex flex-col">
        {heading("Overview")}
        {link("/", "Dashboard")}
        {link("/tasks", "My tasks", counts.tasks, counts.tasks > 0)}
        {link("/team", "Team")}

        {heading("Journey")}
        <div className="flex flex-col gap-1">
          {/* Each stage: a thin bar in its color, then name and purpose. Active = light tint. */}
          {JOURNEY.map((j) => {
            const on = active(j.href);
            return (
              <Link key={j.key} href={j.href}
                className={`flex items-stretch gap-3 px-3 py-2 transition-colors ${on ? j.tint : "hover:bg-wash"}`}>
                <span className={`w-[3px] shrink-0 ${j.bg}`} aria-hidden />
                <span className="min-w-0">
                  <span className={`block text-sm text-ink ${on ? "font-semibold" : ""}`}>{j.label}</span>
                  <span className="block truncate text-xs text-muted">{j.purpose}</span>
                </span>
              </Link>
            );
          })}
        </div>

        {heading("Tools")}
        {link("/contacts", "All contacts")}
        {link("/organizations", "Organizations")}
        {link("/drafts", "Drafts to review", counts.drafts)}
        {link("/surveys/unmatched", "Unmatched surveys", counts.unmatched)}
        {link("/settings/notifications", "Notifications")}
      </nav>

      <Link href="/contacts/new" className="btn btn-primary mx-3 mt-8">+ Add contact</Link>

      <div className="mt-6 border-t border-line px-3 pt-4 text-xs text-muted md:mt-auto">
        Signed in as <span className="font-medium text-ink">{userName}</span>
        {demo ? <div className="mt-1 text-faint">Demo mode · sample data</div> : (
          <div className="mt-1"><a className="link" href="/api/auth/signout">Sign out</a></div>
        )}
      </div>
      </div>
    </aside>
  );
}
