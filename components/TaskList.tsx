"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, isTrue, isUrgent } from "@/lib/util";
import { postJson } from "./Modal";
import { TaskFormModal, type ClientOption } from "./TaskForm";
import { Spinner } from "./ui";

export type TaskRow = Record<string, string> & { contact_name?: string };

const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

/**
 * Task rows: check off, click the title to edit, reassign from the dropdown.
 * Adding happens through "+ New task" (components/TaskForm.tsx).
 */
export function TaskList({ tasks, clients, people, me, showContact = false, empty = "No tasks." }: {
  tasks: TaskRow[]; clients: ClientOption[]; people: string[]; me: string;
  showContact?: boolean; empty?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [error, setError] = useState("");
  const today = todayStr();

  const patch = async (t: TaskRow, body: Record<string, string>) => {
    setBusyId(t.id); setError("");
    try { await postJson(`/api/tasks/${t.id}`, body, "PATCH"); router.refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(""); }
  };

  if (!tasks.length) return <p className="muted">{empty}</p>;
  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        {tasks.map((t) => {
          const done = isTrue(t.done);
          const overdue = !done && t.due_date && t.due_date < today;
          const dueToday = !done && t.due_date === today;
          const options = t.assigned_to && !people.includes(t.assigned_to) ? [...people, t.assigned_to] : people;
          return (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <input type="checkbox" className="accent-forest" checked={done} disabled={busyId === t.id}
                onChange={() => patch(t, { done: done ? "" : "TRUE" })} aria-label={`Mark "${t.title}" ${done ? "not done" : "done"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  {isUrgent(t) && <UrgentTag auto={t.priority !== "Urgent"} />}
                  <button type="button" onClick={() => setEditing(t)}
                    className={`min-w-0 truncate text-left text-sm hover:underline ${done ? "text-faint line-through" : "text-ink"}`}>
                    {t.title}
                  </button>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                  {showContact && t.contact_id && (
                    <Link href={`/contacts/${t.contact_id}`} className="truncate font-medium text-ink/80 hover:underline">{t.contact_name || "Client"}</Link>
                  )}
                  {t.due_date && (
                    <span className={overdue ? "font-semibold text-coral" : dueToday ? "font-semibold text-ink" : ""}>
                      {overdue ? "Overdue · " : dueToday ? "Today · " : "Due "}{formatDate(t.due_date)}
                    </span>
                  )}
                </div>
              </div>
              {busyId === t.id && <Spinner />}
              {!done && (
                <select className="max-w-32 shrink-0 cursor-pointer border border-transparent bg-transparent py-0.5 text-xs text-muted hover:border-line hover:text-ink"
                  value={t.assigned_to || ""} disabled={busyId === t.id} aria-label={`Assignee for "${t.title}"`}
                  onChange={(e) => patch(t, { assigned_to: e.target.value })}>
                  {options.map((p) => <option key={p} value={p}>{p === me ? `${p} (you)` : p}</option>)}
                  <option value="">Unassigned</option>
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      {editing && <TaskFormModal task={editing} clients={clients} people={people} defaultAssignee={me} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Red "Urgent" tag. auto = urgent because it's 3+ days overdue. */
export function UrgentTag({ auto = false }: { auto?: boolean }) {
  return (
    <span title={auto ? "Urgent: 3+ days overdue" : "Marked urgent"}
      className="shrink-0 rounded-xs bg-coral/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-coral">Urgent</span>
  );
}
