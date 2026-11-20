"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";
import { CHANNELS, INTERACTION_TYPES, PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data/schema";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogInteractionModal({ contact, onClose }: {
  contact: Record<string, string>; // a contact row
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    type: "call", channel: "other", summary: "", date: todayStr(), stage: "", research_status: "", next_followup_date: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const prospect = contact.contact_type !== "research_participant";
  const research = contact.contact_type !== "prospect";

  return (
    <Modal title={`Log interaction · ${contact.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError("");
          try {
            await postJson("/api/interactions", { contact_id: contact.id, ...form });
            router.refresh();
            onClose();
          } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">Channel</label>
            <select className="input" value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              {CHANNELS.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
        </div>
        <div><label className="label">What happened?</label>
          <textarea required className="input min-h-24" value={form.summary} onChange={(e) => set("summary", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {prospect && <div><label className="label">Move stage (optional)</label>
            <select className="input" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              <option value="">Keep: {contact.stage || "—"}</option>
              {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select></div>}
          {research && <div><label className="label">Research status (optional)</label>
            <select className="input" value={form.research_status} onChange={(e) => set("research_status", e.target.value)}>
              <option value="">Keep: {contact.research_status || "—"}</option>
              {RESEARCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select></div>}
          <div><label className="label">Next follow-up (optional)</label>
            <input type="date" className="input" value={form.next_followup_date} onChange={(e) => set("next_followup_date", e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
