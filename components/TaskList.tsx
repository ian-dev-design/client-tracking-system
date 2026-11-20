"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, isTrue } from "@/lib/util";
import { postJson } from "./Modal";
import { Spinner } from "./ui";

export type TaskRow = Record<string, string> & { contact_name?: string };

const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

/** Check off, add and assign tasks. On a profile pass `contactId`; in My tasks pass `showContact`. */
export function TaskList({ tasks, contactId, assignees, me, showContact = false, allowAdd = true, empty = "No tasks." }: {
  tasks: TaskRow[]; contactId?: string; assignees: string[]; me: string;
  showContact?: boolean; allowAdd?: boolean; empty?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", assigned_to: me });
  const [error, setError] = useState("");
  const today = todayStr();

  const toggle = async (t: TaskRow) => {
    setBusyId(t.id);
    try { await postJson(`/api/tasks/${t.id}`, { done: isTrue(t.done) ? "" : "TRUE" }, "PATCH"); router.refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(""); }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true); setError("");
    try {
      await postJson("/api/tasks", { ...form, contact_id: contactId || "" });
      setForm({ title: "", due_date: "", assigned_to: me });
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setAdding(false); }
  };

  return (
    <div>
      {tasks.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {tasks.map((t) => {
            const done = isTrue(t.done);
            const overdue = !done && t.due_date && t.due_date < today;
            const dueToday = !done && t.due_date === today;
            return (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <input type="checkbox" className="mt-1 accent-forest" checked={done} disabled={busyId === t.id}
                  onChange={() => toggle(t)} aria-label={`Mark "${t.title}" ${done ? "not done" : "done"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${done ? "text-faint line-through" : "text-ink"}`}>{t.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    {t.due_date && (
                      <span className={overdue ? "font-semibold text-coral" : dueToday ? "font-semibold text-ink" : ""}>
                        {overdue ? "Overdue · " : dueToday ? "Today · " : "Due "}{formatDate(t.due_date)}
                      </span>
                    )}
                    <span>{t.assigned_to === me ? "You" : t.assigned_to || "Unassigned"}</span>
                    {showContact && t.contact_id && (
                      <Link href={`/contacts/${t.contact_id}`} className="truncate hover:underline">{t.contact_name || "Contact"}</Link>
                    )}
                  </div>
                </div>
                {busyId === t.id && <Spinner />}
              </li>
            );
          })}
        </ul>
      ) : <p className="muted">{empty}</p>}

      {allowAdd && (
        <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input className="input" placeholder="Add a task…" value={form.title} required
            onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Task title" />
          <input className="input sm:w-40" type="date" value={form.due_date} aria-label="Due date"
            onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <input className="input sm:w-32" list="task-assignees" value={form.assigned_to} aria-label="Assign to"
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
          <datalist id="task-assignees">{assignees.map((a) => <option key={a} value={a} />)}</datalist>
          <button className="btn" disabled={adding}>{adding && <Spinner />}Add</button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}
