"use client";

// Team → Activity: what everyone did lately, newest first. Pick a teammate card or a type to narrow it down.

import { useState } from "react";
import Link from "next/link";
import type { ActivityItem, ActivityKind } from "@/lib/teamStats";
import { timeAgo } from "@/lib/util";
import { EveryoneCard, PersonCardBody, PersonGrid, type CardStats, type TeamColumn } from "./TeamBoard";

const KIND: Record<ActivityKind, { label: string; color: string; icon: React.ReactNode }> = {
  done: { label: "Task completed", color: "text-success", icon: <path d="M3 8.5l3 3 7-7" /> },
  assign: { label: "Task assigned", color: "text-info", icon: <><circle cx="6" cy="5" r="2.5" /><path d="M1.5 13c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M12.5 5v5M10 7.5h5" /></> },
  reassign: { label: "Reassigned", color: "text-info", icon: <path d="M2 5h10l-2.5-2.5M14 11H4l2.5 2.5" /> },
  stage: { label: "Stage move", color: "text-tl-stage", icon: <path d="M3 3l5 5-5 5M8 3l5 5-5 5" /> },
  outreach: { label: "Outreach", color: "text-tl-email", icon: <><rect x="1.5" y="3.5" width="13" height="9" rx="1" /><path d="M2 4l6 5 6-5" /></> },
  interview: { label: "Interview / meeting", color: "text-tl-interview", icon: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /> },
};
const FILTERS: { key: "" | ActivityKind | "tasks" | "talks"; label: string }[] = [
  { key: "", label: "All" }, { key: "tasks", label: "Tasks" }, { key: "stage", label: "Stage moves" }, { key: "talks", label: "Outreach & interviews" },
];
const matches = (f: string, k: ActivityKind) => !f || f === k || (f === "tasks" && ["done", "assign", "reassign"].includes(k)) || (f === "talks" && ["outreach", "interview"].includes(k));

export function TeamActivity({ items, people, initialWho }: { items: ActivityItem[]; people: TeamColumn[]; initialWho?: string | null }) {
  const [who, setWho] = useState<string | null>(initialWho ?? null);
  const [filter, setFilter] = useState("");
  const mates = people.filter((p) => p.key);
  const stats = (key: string | null): CardStats => {
    const n = items.filter((i) => key === null || i.who === key).length;
    return { open: n, overdue: 0, share: items.length ? n / items.length : 0 };
  };
  const shown = items.filter((i) => (who === null || i.who === who) && matches(filter, i.kind));

  return (
    <>
      <PersonGrid>
        <EveryoneCard stats={stats(null)} selected={who === null} onClick={() => setWho(null)} unit="updates" />
        {mates.map((p) => (
          <button key={p.key} type="button" onClick={() => setWho(who === p.key ? null : p.key)} aria-pressed={who === p.key}
            className={`flex min-h-[7.25rem] flex-col border bg-white p-3 text-left transition-colors ${who === p.key ? "border-forest bg-forest/[0.04] shadow-[inset_0_0_0_1px_var(--color-forest)]" : "border-line hover:bg-surface"}`}>
            <PersonCardBody label={p.label} stats={stats(p.key)} selected={who === p.key} unit="updates" />
          </button>
        ))}
      </PersonGrid>

      <div className="mt-8 mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`rounded-xs border px-2.5 py-1 text-xs ${filter === f.key ? "border-forest bg-forest font-semibold text-paper" : "border-line bg-white text-muted hover:text-ink"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length ? (
        <ol className="max-w-3xl divide-y divide-line border-y border-line">
          {shown.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-3">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-white ${KIND[i.kind].color}`} title={KIND[i.kind].label}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{KIND[i.kind].icon}</svg>
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-semibold text-ink">{i.who}</span> <span className="text-ink">{i.text}</span>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-faint">
                  {i.clientId && <Link href={`/contacts/${i.clientId}`} className="text-muted hover:text-ink hover:underline">{i.client}</Link>}
                  {i.clientId && <span aria-hidden>·</span>}
                  <span>{timeAgo(i.at)}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="muted">Nothing here yet{who ? ` for ${people.find((p) => p.key === who)?.label || who}` : ""}.</p>}
    </>
  );
}
