"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";
import { DraftOutreachModal } from "./DraftOutreach";
import { toast } from "./Toast";

/** Menu-item look for actions placed inside a "⋯" menu. */
export const MENU_ITEM = "block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface disabled:text-faint";

/** Inline stage / research-status picker on the profile. */
export function StatusSelect({ contactId, field, value, options }: {
  contactId: string; field: "stage" | "research_status"; value: string; options: readonly string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <select
      className="input w-auto py-1"
      value={value}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value;
        const body: Record<string, string> = { [field]: next };
        if (next === "Churned / Lost") {
          const reason = prompt("Why was this lost? (required)");
          if (!reason) return;
          body.lost_reason = reason;
        }
        setBusy(true);
        const ok = await postJson(`/api/contacts/${contactId}`, body, "PATCH").then(() => true, (err) => { alert(err.message); return false; });
        setBusy(false);
        if (ok) toast(`Moved to ${next}`);
        router.refresh();
      }}
    >
      {!value && <option value="">—</option>}
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

export function ActionButton({ url, body, label, method = "PATCH", confirmText, doneText = "Done", variant = "button" }: {
  url: string; body: Record<string, unknown>; label: string; method?: string; confirmText?: string;
  doneText?: string; variant?: "button" | "menu";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={variant === "menu" ? MENU_ITEM : "btn"}
      disabled={busy}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        const ok = await postJson(url, body, method).then(() => true, (e) => { alert(e.message); return false; });
        setBusy(false);
        if (ok) toast(doneText);
        router.refresh();
      }}
    >
      {busy && <Spinner />}{label}
    </button>
  );
}

/** Link an unmatched survey response to a contact, or create a new contact from it. */
export function UnmatchedActions({ responseKey, contacts }: { responseKey: string; contacts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (body: Record<string, unknown>) => {
    setBusy(true);
    const ok = await postJson("/api/surveys/link", { key: responseKey, ...body }).then(() => true, (e) => { alert(e.message); return false; });
    setBusy(false);
    if (ok) toast(body.create ? "Contact created and survey linked" : "Survey linked");
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-full min-w-0 sm:w-auto" value={contactId} onChange={(e) => setContactId(e.target.value)}>
        <option value="">Link to contact…</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className="btn" disabled={!contactId || busy} onClick={() => go({ contactId })}>Link</button>
      <span className="text-xs text-faint">or</span>
      <button className="btn" disabled={busy} onClick={() => go({ create: true })}>Create new contact</button>
    </div>
  );
}

/** Review saved drafts (from /outreach) one by one. */
export function ReviewDraftsButton({ contactIds, testRedirect, label }: { contactIds: string[]; testRedirect?: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" disabled={!contactIds.length} onClick={() => setOpen(true)}>{label}</button>
      {open && <DraftOutreachModal contactIds={contactIds} testRedirect={testRedirect} onClose={() => setOpen(false)} />}
    </>
  );
}

const MOVES = {
  onboarding: {
    label: "→ Move to Onboarding",
    confirm: (name: string) => `Move ${name} to Onboarding?\n\nThis creates their checklist and saves a welcome email in Drafts for you to review. Nothing is sent.`,
    body: () => ({ action: "start_onboarding" }),
    cls: "btn-primary",
    done: "Moved to Onboarding",
  },
  active: {
    label: "→ Move to Active / Retention",
    confirm: (name: string) => `Onboarding done? Move ${name} to Active / Retention.`,
    body: () => ({ stage: "Active / Retention" }),
    cls: "btn-primary",
    done: "Moved to Active / Retention",
  },
  churn: {
    label: "Mark as churned",
    confirm: () => "",
    body: () => ({ stage: "Churned / Lost" }),
    cls: "btn-danger",
    done: "Marked as churned",
  },
};

/**
 * "Move to Onboarding": asks for handoff notes (what outreach learned) before moving, then opens the client's
 * onboarding page so the notes are right there. Creates the onboarding row and a welcome draft; sends nothing.
 */
export function HandoffModal({ contactId, name, onClose }: { contactId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await postJson(`/api/contacts/${contactId}`, { action: "start_onboarding", handoff_notes: notes }, "PATCH");
      toast(`${name} moved to Onboarding`);
      router.push(`/onboarding/${contactId}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <Modal title={`Move ${name} to Onboarding`} onClose={onClose}>
      <form onSubmit={save} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm text-muted">They start in the first onboarding stage. A welcome email is saved in Drafts for you to review; nothing is sent.</p>
        <label className="label" htmlFor="handoff-notes">Handoff notes</label>
        <textarea id="handoff-notes" className="input min-h-28" value={notes} autoFocus onChange={(e) => setNotes(e.target.value)}
          placeholder="What outreach learned: what was promised, key contacts, their goals…" />
        <p className="mt-1 text-xs text-faint">Shown on their onboarding page. You can edit it there later.</p>
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Move to Onboarding</button>
        </div>
      </form>
    </Modal>
  );
}

/** Moves a client to the next part of the journey. Every move is logged with who made it. */
export function MoveButton({ contactId, name, to, size = "md", variant = "button" }: {
  contactId: string; name: string; to: keyof typeof MOVES; size?: "sm" | "md"; variant?: "button" | "menu";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const m = MOVES[to];
  const go = async () => {
    if (to === "onboarding") return setHandoff(true);
    const body: Record<string, string> = m.body();
    if (to === "churn") {
      const reason = prompt(`Why did ${name} churn? (required)`);
      if (!reason?.trim()) return;
      body.lost_reason = reason.trim();
    } else if (!confirm(m.confirm(name))) return;
    setBusy(true);
    const ok = await postJson(`/api/contacts/${contactId}`, body, "PATCH").then(() => true, (e) => { alert(e.message); return false; });
    setBusy(false);
    if (ok) toast(m.done);
    router.refresh();
  };
  return (<>
    <button className={variant === "menu" ? MENU_ITEM : `btn ${size === "sm" ? "btn-sm" : ""} ${m.cls}`} disabled={busy}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(); }}>
      {busy && <Spinner />}{m.label}
    </button>
    {handoff && <HandoffModal contactId={contactId} name={name} onClose={() => setHandoff(false)} />}
  </>);
}
