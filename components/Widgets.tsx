"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { Spinner } from "./ui";
import { DraftOutreachModal } from "./DraftOutreach";

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
        await postJson(`/api/contacts/${contactId}`, body, "PATCH").catch((err) => alert(err.message));
        setBusy(false);
        router.refresh();
      }}
    >
      {!value && <option value="">—</option>}
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

export function ActionButton({ url, body, label, method = "PATCH", confirmText }: {
  url: string; body: Record<string, unknown>; label: string; method?: string; confirmText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        await postJson(url, body, method).catch((e) => alert(e.message));
        setBusy(false);
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
    await postJson("/api/surveys/link", { key: responseKey, ...body }).catch((e) => alert(e.message));
    setBusy(false);
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
  },
  active: {
    label: "→ Move to Active / Retention",
    confirm: (name: string) => `Onboarding done? Move ${name} to Active / Retention.`,
    body: () => ({ stage: "Active / Retention" }),
    cls: "btn-primary",
  },
  churn: {
    label: "Mark as churned",
    confirm: () => "",
    body: () => ({ stage: "Churned / Lost" }),
    cls: "btn-danger",
  },
};

/** Moves a client to the next part of the journey. Every move is logged with who made it. */
export function MoveButton({ contactId, name, to, size = "md" }: {
  contactId: string; name: string; to: keyof typeof MOVES; size?: "sm" | "md";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const m = MOVES[to];
  const go = async () => {
    const body: Record<string, string> = m.body();
    if (to === "churn") {
      const reason = prompt(`Why did ${name} churn? (required)`);
      if (!reason?.trim()) return;
      body.lost_reason = reason.trim();
    } else if (!confirm(m.confirm(name))) return;
    setBusy(true);
    await postJson(`/api/contacts/${contactId}`, body, "PATCH").catch((e) => alert(e.message));
    setBusy(false);
    router.refresh();
  };
  return (
    <button className={`btn ${size === "sm" ? "btn-sm" : ""} ${m.cls}`} disabled={busy}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); go(); }}>
      {busy && <Spinner />}{m.label}
    </button>
  );
}
