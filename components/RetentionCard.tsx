"use client";

// Retention pieces that used to live on the old retention card:
// - RetentionMenu: the "⋯" actions on a Retention board card (draft check-in, log, profile, churn)
// - RetentionSignals: retention signals to check off + notes, shown on the client's profile

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/util";
import { DraftOutreachModal } from "./DraftOutreach";
import { LogInteractionModal } from "./LogInteraction";
import { postJson } from "./Modal";
import { MENU_ITEM, MoveButton } from "./Widgets";
import { toast } from "./Toast";

/** "⋯" menu on a Retention board card. Popups live here, not inside the menu, so they survive it closing. */
export function RetentionMenu({ contact, churned, testRedirect }: {
  contact: { id: string; name: string; stage: string; research_status: string; contact_type: string }; churned: boolean; testRedirect?: string;
}) {
  const [open, setOpen] = useState<"" | "menu" | "draft" | "log">("");
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation() };
  return (
    <div className="relative" {...stop}>
      <button type="button" aria-label={`Actions for ${contact.name}`} onClick={() => setOpen(open === "menu" ? "" : "menu")}
        className={`px-1 text-base leading-none text-muted hover:text-ink ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"}`}>⋯</button>
      {open === "menu" && (
        <div className="absolute right-0 z-20 mt-1 w-48 border border-line bg-white py-1" onMouseLeave={() => setOpen("")}>
          {!churned && <button className={MENU_ITEM} onClick={() => setOpen("draft")}>Draft check-in</button>}
          <button className={MENU_ITEM} onClick={() => setOpen("log")}>Log interaction</button>
          <Link className={MENU_ITEM} href={`/contacts/${contact.id}`}>Open profile</Link>
          {!churned && <><div className="my-1 border-t border-line" /><MoveButton variant="menu" contactId={contact.id} name={contact.name} to="churn" /></>}
        </div>
      )}
      {open === "draft" && <DraftOutreachModal contactIds={[contact.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={contact} onClose={() => setOpen("")} />}
    </div>
  );
}

export type RetentionSignalsView = {
  id: string; // retention row id ("" if none yet — the API creates it on first change)
  contactId: string; notes: string;
  signals: { key: string; label: string; done: boolean; date: string }[];
};

/** Signs a client is sticking around, to check off, plus retention notes. */
export function RetentionSignals({ item }: { item: RetentionSignalsView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const save = async (body: Record<string, string>, done: string) => {
    setBusy(true);
    try { await postJson("/api/retention", { id: item.id, contactId: item.contactId, ...body }); toast(done); router.refresh(); }
    catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      <ul className="space-y-1.5">
        {item.signals.map((s) => (
          <li key={s.key}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-forest" checked={s.done} disabled={busy} onChange={() => save({ signal: s.key }, s.done ? "Unchecked" : "Checked")} />
              <span>{s.label}</span>
              {s.date && <span className="text-xs text-faint">{formatDate(s.date)}</span>}
            </label>
          </li>
        ))}
      </ul>
      <label className="label mt-4" htmlFor={`rt-notes-${item.contactId}`}>Retention notes</label>
      <input id={`rt-notes-${item.contactId}`} className="input" value={notes} placeholder="e.g. wants a spring and fall booking"
        onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== item.notes && save({ notes }, "Notes saved")} />
    </div>
  );
}
