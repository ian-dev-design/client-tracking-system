"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { formatDate } from "@/lib/util";
import { MoveButton } from "./Widgets";

export type OnboardingView = {
  id: string; contactId: string; name: string; company: string; owner: string; health: string;
  blockers: string; daysSinceStart: number | null; progress: number;
  steps: { key: string; label: string; done: boolean; date: string }[];
};

// Health: green = forest, yellow = sand, red = coral.
const HEALTH: Record<string, string> = { green: "text-forest", yellow: "text-sand", red: "text-coral" };

export function OnboardingCard({ item }: { item: OnboardingView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState(item.blockers);
  const save = async (body: Record<string, string>) => {
    setBusy(true);
    try { await postJson("/api/onboarding", { id: item.id, ...body }); router.refresh(); } finally { setBusy(false); }
  };
  return (
    <div className="border border-l-[3px] border-line border-l-sand bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/contacts/${item.contactId}`} className="text-[15px] font-semibold hover:underline">{item.name}</Link>
          <div className="text-xs text-muted">{item.company} · Owner: {item.owner} · Day {item.daysSinceStart ?? "—"}</div>
        </div>
        <select
          className={`border border-line bg-white py-0.5 pl-1.5 text-xs font-medium ${HEALTH[item.health || "green"]}`}
          value={item.health || "green"} disabled={busy} onChange={(e) => save({ health: e.target.value })}
          aria-label="Health"
        >
          <option value="green">● Healthy</option><option value="yellow">● Needs attention</option><option value="red">● At risk</option>
        </select>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 bg-wash">
          <div className="h-full bg-sand" style={{ width: `${item.progress}%` }} />
        </div>
        <span className="text-xs font-medium text-muted">{item.progress}%</span>
      </div>
      <ul className="mt-3 space-y-1">
        {item.steps.map((s) => (
          <li key={s.key}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-forest" checked={s.done} disabled={busy} onChange={() => save({ step: s.key })} />
              <span className={s.done ? "text-faint line-through" : ""}>{s.label}</span>
              {s.date && <span className="text-xs text-faint">{formatDate(s.date)}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <label className="label">Blockers</label>
        <textarea className="input min-h-[2.5rem] resize-y leading-snug" rows={2} value={blockers} placeholder="None"
          onChange={(e) => setBlockers(e.target.value)}
          onBlur={() => blockers !== item.blockers && save({ blockers })} />
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <MoveButton contactId={item.contactId} name={item.name} to="active" size="sm" />
      </div>
    </div>
  );
}
