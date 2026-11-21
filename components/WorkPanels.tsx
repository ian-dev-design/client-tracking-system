"use client";

// The interactive parts of the "Work on this" page (app/(app)/work/[id]/page.tsx).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, isUrgent } from "@/lib/util";
import { AddInterviewModal } from "./AddInterview";
import { DraftEditor } from "./DraftOutreach";
import { LogInteractionForm } from "./LogInteraction";
import { postJson } from "./Modal";
import { OnboardingCard, type OnboardingView } from "./OnboardingCard";
import { UrgentTag } from "./TaskList";
import { Spinner } from "./ui";
import { toast } from "./Toast";

/** "Assign to…": the task's assignee for a task item, otherwise the client's owner. Logged as a reassignment. */
export function AssignControl({ kind, id, value, people, label }: {
  kind: "task" | "client"; id: string; value: string; people: string[]; label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const options = value && !people.includes(value) ? [...people, value] : people;
  const change = async (to: string) => {
    setBusy(true);
    try {
      if (kind === "task") await postJson(`/api/tasks/${id}`, { assigned_to: to }, "PATCH");
      else await postJson(`/api/contacts/${id}`, { owner: to }, "PATCH");
      toast(`Assigned to ${to || "Unassigned"}`);
      router.refresh();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select className="input w-auto py-1" value={value} disabled={busy} onChange={(e) => change(e.target.value)}>
        {options.map((p) => <option key={p} value={p}>{p}</option>)}
        {kind === "task" && <option value="">Unassigned</option>}
      </select>
      {busy && <Spinner />}
    </label>
  );
}

/** A finished state shared by all work types. */
function Done({ message, nextHref }: { message: string; nextHref: string | null }) {
  return (
    <div className="border-l-[3px] border-l-success bg-success/10 px-5 py-4">
      <p className="text-sm font-medium text-outreach-ink">✓ {message}</p>
      <div className="mt-3 flex gap-2">
        {nextHref ? <Link href={nextHref} className="btn btn-primary">Next item →</Link> : <Link href="/" className="btn btn-primary">Back to dashboard</Link>}
      </div>
    </div>
  );
}

/** Follow-up, interview request or check-in: the draft editor, right here. */
export function WorkDraft({ contactId, purpose, testRedirect, nextHref }: {
  contactId: string; purpose?: string; testRedirect?: string; nextHref: string | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState("");
  if (done) return <Done message={done} nextHref={nextHref} />;
  return <DraftEditor contactId={contactId} initialPurpose={purpose} testRedirect={testRedirect}
    onDone={(m) => { toast(m); setDone(m); router.refresh(); }} />;
}

/** Ready for interview: the drafted request, plus adding the interview once it's happened. */
export function WorkInterview({ contact, testRedirect, nextHref, aiEnabled }: {
  contact: Record<string, string>; testRedirect?: string; nextHref: string | null; aiEnabled: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-6">
      <WorkDraft contactId={contact.id} purpose="interview_request" testRedirect={testRedirect} nextHref={nextHref} />
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        <span className="text-muted">Already talked to them?</span>
        <button className="btn" onClick={() => setAdding(true)}>+ Add interview</button>
      </div>
      {adding && <AddInterviewModal contact={contact} aiEnabled={aiEnabled} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Task overdue or due: the task, a note, and Mark done. */
export function WorkTask({ task, client, nextHref }: { task: Record<string, string>; client: string; nextHref: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(task.notes || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const overdue = task.due_date && task.due_date < new Date().toLocaleDateString("en-CA");
  const save = async (body: Record<string, string>, message: string) => {
    setBusy(true);
    try { await postJson(`/api/tasks/${task.id}`, body, "PATCH"); toast(message); router.refresh(); return true; }
    catch (e) { alert((e as Error).message); return false; } finally { setBusy(false); }
  };
  if (done) return <Done message={`Done: ${task.title}`} nextHref={nextHref} />;
  return (
    <div className="space-y-5">
      <div className="border border-line bg-white p-5">
        <div className="flex items-start gap-2">
          {isUrgent(task) && <UrgentTag auto={task.priority !== "Urgent"} />}
          <h2 className="text-lg font-semibold text-ink">{task.title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          {client && <>{client} · </>}
          {task.due_date ? <span className={overdue ? "font-semibold text-coral" : "font-semibold text-amber-ink"}>{overdue ? "Overdue since" : "Due"} {formatDate(task.due_date)}</span> : "No due date"}
          {" "}· assigned to {task.assigned_to || "nobody"}
        </p>
        <label className="label mt-5" htmlFor="work-note">Note</label>
        <textarea id="work-note" className="input min-h-24" value={notes} placeholder="What happened, what's next…"
          onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" disabled={busy || notes === (task.notes || "")} onClick={() => save({ notes }, "Note saved")}>Save note</button>
          <button className="btn btn-primary" disabled={busy}
            onClick={async () => { if (await save({ done: "TRUE", ...(notes !== (task.notes || "") ? { notes } : {}) }, "Marked done")) setDone(true); }}>
            {busy && <Spinner />}Mark done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Onboarding: the checklist with clickable steps, blockers and health. */
export function WorkOnboarding({ item }: { item: OnboardingView }) {
  return <OnboardingCard item={item} />;
}

/** Quiet client: a drafted check-in, and a place to log the conversation. */
export function WorkQuiet({ contact, testRedirect, nextHref }: { contact: Record<string, string>; testRedirect?: string; nextHref: string | null }) {
  const router = useRouter();
  const [logged, setLogged] = useState(false);
  return (
    <div className="space-y-8">
      <WorkDraft contactId={contact.id} purpose="followup" testRedirect={testRedirect} nextHref={nextHref} />
      <section className="border-t border-line pt-5">
        <h3 className="mb-3 text-base font-semibold text-ink">Log a check-in</h3>
        {logged ? <Done message="Check-in logged" nextHref={nextHref} />
          : <LogInteractionForm contact={contact} onDone={() => { setLogged(true); router.refresh(); }} />}
      </section>
    </div>
  );
}
