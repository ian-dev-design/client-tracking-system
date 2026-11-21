"use client";

import { toast } from "./Toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";
import { CHANNELS, TEMPLATE_PURPOSES } from "@/lib/data/schema";

type Draft = {
  draftId?: string; contactId: string; to: string; name: string; template: string;
  subject: string; body: string; short_body: string; source: string;
};

/**
 * The draft editor for one contact: Approve & send, Copy text, Mark as sent. Used inside the popup below
 * and inline on the "Work on this" page. Nothing is sent until "Approve & send" is clicked.
 */
export function DraftEditor({ contactId, initialPurpose = "", testRedirect, onDone, onSkip }: {
  contactId: string; initialPurpose?: string; testRedirect?: string;
  onDone: (message: string) => void; onSkip?: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [channel, setChannel] = useState("linkedin");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(null); setError(""); setCopied(false);
    postJson("/api/outreach/draft", { contactId, purpose: purpose || undefined })
      .then((d: Draft) => setDraft(d))
      .catch((e) => setError(e.message));
  }, [contactId, purpose]);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true); setError("");
    try { onDone(await fn()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const send = () => act(async () => {
    const r = await postJson("/api/outreach/send", {
      contactId, draftId: draft!.draftId, subject: draft!.subject, body: draft!.body, approved: true,
    });
    return `${draft!.name}: ${r.demo ? "logged as sent (demo mode, no email)" : `sent to ${r.to}`}`;
  });
  const markSent = () => act(async () => {
    await postJson("/api/outreach/mark-sent", { contactId, channel, body: draft!.short_body, draftId: draft!.draftId });
    return `${draft!.name}: marked as sent via ${channel}`;
  });

  if (!draft) return <p className={`text-sm ${error ? "text-coral" : "text-muted"}`}>{error || <><Spinner /> Preparing draft…</>}</p>;
  return (
    <div className="space-y-4">
      {testRedirect && (
        <div className="border-l-[3px] border-amber bg-amber/10 px-3 py-2 text-xs text-ink">
          Test mode: emails go to <b>{testRedirect}</b>, not to {draft.to || "the contact"}.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">To:</span>
        <span className="font-medium">{draft.name}</span>
        <span className="text-faint">{draft.to || "(no email)"}</span>
        <span className="ml-auto" />
        {draft.source === "saved" && <span className="chip bg-success/10 text-outreach-ink">Saved draft</span>}
        <select className="input w-auto py-1 text-xs" aria-label="Template" value={purpose || draft.template} onChange={(e) => setPurpose(e.target.value)}>
          {TEMPLATE_PURPOSES.map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Subject</label>
        <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
      </div>
      <div>
        <label className="label">Email</label>
        <textarea className="input min-h-56 font-[inherit]" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {!draft.to && <span className="mr-auto text-xs text-muted">No email address on file. Use the short version below.</span>}
        {onSkip && <button className="btn" onClick={onSkip} disabled={busy}>Skip</button>}
        <button className="btn btn-primary" disabled={busy || !draft.to} onClick={send}>
          {busy && <Spinner />}{busy ? "Sending…" : <>Approve &amp; send from my Gmail</>}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <label className="label">Short version (LinkedIn, iMessage, anywhere)</label>
        <textarea className="input min-h-20" value={draft.short_body} onChange={(e) => setDraft({ ...draft, short_body: e.target.value })} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn" onClick={async () => { await navigator.clipboard.writeText(draft.short_body); setCopied(true); toast("Copied"); }}>
            {copied ? "✓ Copied" : "Copy text"}
          </button>
          {copied && (
            <>
              <span className="text-xs text-muted">Sent it? Log it:</span>
              <select className="input w-auto py-1" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn" disabled={busy} onClick={markSent}>{busy && <Spinner />}Mark as sent</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Review a draft for each contact in `contactIds`, one at a time (no blind mass-send). */
export function DraftOutreachModal({ contactIds, testRedirect, onClose }: {
  contactIds: string[]; testRedirect?: string; onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const next = (message: string) => {
    setDone((d) => [...d, message]);
    toast(message);
    router.refresh();
    setIndex((i) => i + 1);
  };
  const finished = index >= contactIds.length;
  const title = contactIds.length > 1 ? `Draft outreach (${Math.min(index + 1, contactIds.length)} of ${contactIds.length})` : "Draft outreach";
  return (
    <Modal title={title} onClose={onClose} wide>
      {finished ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-sm">{done.map((d, i) => <li key={i}>✓ {d}</li>)}</ul>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
        </div>
      ) : (
        <DraftEditor key={contactIds[index]} contactId={contactIds[index]} testRedirect={testRedirect} onDone={next}
          onSkip={contactIds.length > 1 ? () => next("Skipped") : undefined} />
      )}
    </Modal>
  );
}
