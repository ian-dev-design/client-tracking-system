"use client";

// "Hand off work": move open tasks and/or owned clients from one person to another.
// Shows exactly what will move before anything changes. Sends no notifications by itself.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/util";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";
import { toast } from "./Toast";
import type { TeamClientCard, TeamColumn, TeamTaskCard } from "./TeamBoard";

export function HandOffButton({ columns, tasks, clients }: { columns: TeamColumn[]; tasks: TeamTaskCard[]; clients: TeamClientCard[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Hand off work</button>
      {open && <HandOffModal columns={columns} tasks={tasks} clients={clients} onClose={() => setOpen(false)} />}
    </>
  );
}

function HandOffModal({ columns, tasks, clients, onClose }: {
  columns: TeamColumn[]; tasks: TeamTaskCard[]; clients: TeamClientCard[]; onClose: () => void;
}) {
  const router = useRouter();
  const label = (key: string) => columns.find((c) => c.key === key)?.label || key || "Unassigned";
  const fromOptions = columns.filter((c) => tasks.some((t) => t.who === c.key) || clients.some((x) => x.who === c.key));
  const [from, setFrom] = useState(fromOptions[0]?.key ?? "");
  const [to, setTo] = useState("");
  const [what, setWhat] = useState<"both" | "tasks" | "clients">("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ tasks: number; clients: number } | null>(null);

  const toOptions = columns.filter((c) => c.key !== from && (c.onTeam || c.key === ""));
  // Clients always need an owner, so "Unassigned" can only receive tasks.
  const moveTasks = what !== "clients" ? tasks.filter((t) => t.who === from) : [];
  const moveClients = what !== "tasks" && to !== "" ? clients.filter((c) => c.who === from) : [];
  const ready = toOptions.some((c) => c.key === to) && (moveTasks.length + moveClients.length > 0);

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      const res = await postJson("/api/team/handoff", {
        from, to, confirmed: true, taskIds: moveTasks.map((t) => t.id), contactIds: moveClients.map((c) => c.id),
      });
      setDone(res);
      toast(`Handed off to ${label(to)}`);
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <Modal title="Work handed off" onClose={onClose}>
        <p className="text-sm">
          Moved {done.tasks} task{done.tasks === 1 ? "" : "s"} and {done.clients} client{done.clients === 1 ? "" : "s"} from {label(from)} to {label(to)}.
          It&apos;s logged on each client&apos;s timeline.
        </p>
        <div className="mt-4 flex justify-end"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Hand off work" onClose={onClose} wide>
      <div className="grid gap-4">
        <div><label className="label" htmlFor="ho-from">Move from</label>
          <select id="ho-from" className="input" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(""); }}>
            {fromOptions.map((c) => <option key={c.key || "_u"} value={c.key}>{c.label}</option>)}
          </select></div>
        <div><label className="label" htmlFor="ho-to">Move to</label>
          <select id="ho-to" className="input" value={toOptions.some((c) => c.key === to) ? to : "__pick"} onChange={(e) => setTo(e.target.value)}>
            <option value="__pick" disabled>Pick a person…</option>
            {toOptions.map((c) => <option key={c.key || "_u"} value={c.key}>{c.label}</option>)}
          </select></div>
      </div>

      <fieldset className="mt-4">
        <legend className="label">What to move</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {([["both", "Open tasks and owned clients"], ["tasks", "Open tasks only"], ["clients", "Owned clients only"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="ho-what" className="accent-forest" checked={what === v} onChange={() => setWhat(v)} />{l}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 border-t border-line pt-4">
        <div className="label">Preview: exactly what will move</div>
        {!toOptions.some((c) => c.key === to) ? <p className="muted">Pick who to move the work to.</p> : (
          <div className="grid gap-5 sm:grid-cols-2">
            {what !== "clients" && (
              <div>
                <div className="mb-1 text-xs font-semibold text-ink">Open tasks ({moveTasks.length})</div>
                {moveTasks.length ? (
                  <ul className="max-h-56 divide-y divide-line overflow-y-auto border-y border-line text-sm">
                    {moveTasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2 py-1.5">
                        <span className="truncate">{t.title}<span className="text-muted"> · {t.client || "No client"}</span></span>
                        {t.due_date && <span className={`shrink-0 text-xs ${t.overdue ? "font-semibold text-coral" : "text-muted"}`}>{formatDate(t.due_date)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted">No open tasks.</p>}
              </div>
            )}
            {what !== "tasks" && (
              <div>
                <div className="mb-1 text-xs font-semibold text-ink">Owned clients ({moveClients.length})</div>
                {to === "" ? <p className="muted">Clients need an owner, so they can&apos;t move to Unassigned.</p>
                  : moveClients.length ? (
                    <ul className="max-h-56 divide-y divide-line overflow-y-auto border-y border-line text-sm">
                      {moveClients.map((c) => (
                        <li key={c.id} className="flex justify-between gap-2 py-1.5">
                          <span className="truncate">{c.name}<span className="text-muted"> · {c.company || "—"}</span></span>
                          <span className="shrink-0 text-xs text-muted">{c.stageLabel}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="muted">No owned clients.</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
        <span className="mr-auto text-xs text-muted">The person receiving the work gets a notification.</span>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!ready || busy} onClick={confirm}>
          {busy && <Spinner />}Move {moveTasks.length + moveClients.length} item{moveTasks.length + moveClients.length === 1 ? "" : "s"}
        </button>
      </div>
    </Modal>
  );
}
