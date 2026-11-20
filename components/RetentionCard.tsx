"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { formatDate } from "@/lib/util";
import { ContactActions } from "./ContactActions";
import { MoveButton } from "./Widgets";

export type RetentionView = {
  id: string; // retention row id ("" if none yet — the API creates it on first change)
  contact: Record<string, string>;
  lastContact: string; daysQuiet: number | null; notes: string;
  signals: { key: string; label: string; done: boolean; date: string }[];
};

/** One active customer: retention signals to check off, last contact, notes, and actions. */
export function RetentionCard({ item, testRedirect }: { item: RetentionView; testRedirect?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const quiet = item.daysQuiet === null || item.daysQuiet >= 30;
  const save = async (body: Record<string, string>) => {
    setBusy(true);
    try { await postJson("/api/retention", { id: item.id, contactId: item.contact.id, ...body }); router.refresh(); } finally { setBusy(false); }
  };
  const c = item.contact;
  return (
    <div className="border border-l-[3px] border-line border-l-clay bg-white p-4">
      <Link href={`/contacts/${c.id}`} className="text-[15px] font-semibold hover:underline">{c.name}</Link>
      <div className="text-xs text-muted">{c.company}{c.owner ? ` · Owner: ${c.owner}` : ""}</div>

      <div className={`mt-3 text-xs ${quiet ? "font-semibold text-coral" : "text-muted"}`}>
        {item.lastContact ? `Last contact ${item.lastContact} · ${item.daysQuiet}d ago` : "Never contacted"}
        {quiet && " — time to check in"}
      </div>

      <div className="label mt-4">Signals</div>
      <ul className="space-y-1">
        {item.signals.map((s) => (
          <li key={s.key}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-forest" checked={s.done} disabled={busy} onChange={() => save({ signal: s.key })} />
              <span>{s.label}</span>
              {s.date && <span className="text-xs text-faint">{formatDate(s.date)}</span>}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <label className="label">Notes</label>
        <input className="input" value={notes} placeholder="e.g. wants a spring and fall booking" 
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== item.notes && save({ notes })} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        <ContactActions contact={c} size="sm" show={["draft", "log"]} testRedirect={testRedirect} />
        <MoveButton contactId={c.id} name={c.name} to="churn" size="sm" />
      </div>
    </div>
  );
}
