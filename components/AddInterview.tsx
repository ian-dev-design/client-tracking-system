"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Spinner } from "./ui";
import { INTERVIEW_PURPOSES } from "@/lib/data/schema";

export function AddInterviewModal({ contact, aiEnabled, onClose }: {
  contact: Record<string, string>; aiEnabled: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "paste" | "doc">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ extracted: boolean } | null>(null);
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time, for the date input

  if (result) {
    return (
      <Modal title="Interview saved" onClose={onClose}>
        <p className="text-sm">The original transcript was saved untouched.</p>
        <p className="muted mt-2">
          {result.extracted
            ? "Summary, pain points, quotes and themes were extracted."
            : "Findings are pending. Run /log-interview in Claude Code to extract the summary, quotes and themes."}
        </p>
        <button className="btn btn-primary mt-4" onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Add interview · ${contact.name}`} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError("");
          const data = new FormData(e.currentTarget);
          data.set("contactId", contact.id);
          try {
            const res = await fetch("/api/interviews", { method: "POST", body: data });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Upload failed");
            setResult(json);
            router.refresh();
          } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Interview date</label>
            <input name="date" type="date" required defaultValue={today} className="input" /></div>
          <div><label className="label">Purpose</label>
            <select name="purpose" className="input" defaultValue="research">
              {INTERVIEW_PURPOSES.map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
            </select></div>
        </div>
        <div className="flex border-b border-line text-sm">
          {([["file", "Upload file"], ["paste", "Paste text"], ["doc", "Google Doc link"]] as const).map(([m, label]) => (
            <button type="button" key={m} onClick={() => setMode(m)}
              className={`-mb-px flex-1 border-b-2 px-2 py-2 ${mode === m ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
          ))}
        </div>
        {mode === "file" && (
          <div>
            <input name="file" type="file" accept=".txt,.md,.docx,.vtt,.srt,.pdf" className="input" />
            <p className="mt-1 text-xs text-faint">.txt, .docx, .vtt/.srt (Zoom/Meet captions), or PDF</p>
          </div>
        )}
        {mode === "paste" && <textarea name="text" className="input min-h-48" placeholder="Paste the transcript…" />}
        {mode === "doc" && <input name="docUrl" className="input" placeholder="https://docs.google.com/document/d/…" />}
        {!aiEnabled && (
          <p className="text-xs text-muted">
            AI extraction in the app is off (no API key). The transcript is saved now; run <code>/log-interview</code> in Claude Code to pull out findings.
          </p>
        )}
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{busy ? "Saving…" : "Save interview"}</button>
        </div>
      </form>
    </Modal>
  );
}
