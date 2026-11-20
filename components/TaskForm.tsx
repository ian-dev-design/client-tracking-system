"use client";

// The one task form, used by "+ New task" (Team, My tasks, a profile) and by clicking a task to edit it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";

export type ClientOption = { id: string; name: string; company: string };
export type TaskInput = Record<string, string | undefined>; // id, title, contact_id, due_date, assigned_to, notes

/** Type to search clients by name or organization; pick one from the list. */
function ClientPicker({ clients, value, onChange }: { clients: ClientOption[]; value: string; onChange: (id: string) => void }) {
  const selected = clients.find((c) => c.id === value);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.toLowerCase().trim();
    return clients.filter((c) => !s || c.name.toLowerCase().includes(s) || c.company.toLowerCase().includes(s)).slice(0, 8);
  }, [clients, q]);

  if (selected) {
    return (
      <div className="input flex items-center justify-between gap-2">
        <span className="truncate">{selected.name}{selected.company && <span className="text-muted"> · {selected.company}</span>}</span>
        <button type="button" className="text-muted hover:text-ink" aria-label="Clear client" onClick={() => { onChange(""); setQ(""); }}>×</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input className="input" placeholder="Search clients…" value={q} aria-label="Client"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto border border-line bg-white text-sm">
          {matches.length ? matches.map((c) => (
            <li key={c.id}>
              <button type="button" className="block w-full truncate px-3 py-2 text-left hover:bg-surface"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.id); setOpen(false); }}>
                {c.name}{c.company && <span className="text-muted"> · {c.company}</span>}
              </button>
            </li>
          )) : <li className="px-3 py-2 text-muted">No match</li>}
        </ul>
      )}
    </div>
  );
}

export function TaskFormModal({ task, clients, people, defaultAssignee, onClose }: {
  task?: TaskInput; // with an id = edit, without = new (values are defaults)
  clients: ClientOption[];
  people: string[]; // teammate names
  defaultAssignee: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = !!task?.id;
  const [form, setForm] = useState({
    title: task?.title || "", contact_id: task?.contact_id || "", due_date: task?.due_date || "",
    assigned_to: task?.assigned_to ?? defaultAssignee, notes: task?.notes || "", priority: task?.priority === "Urgent" ? "Urgent" : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Keep a current assignee that isn't on the team list selectable, so editing never silently drops it.
  const options = form.assigned_to && !people.includes(form.assigned_to) ? [...people, form.assigned_to] : people;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (editing) await postJson(`/api/tasks/${task!.id}`, form, "PATCH");
      else await postJson("/api/tasks", form);
      router.refresh();
      onClose();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <Modal title={editing ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div><label className="label" htmlFor="task-title">Title</label>
          <input id="task-title" className="input" required autoFocus value={form.title} onChange={(e) => set("title")(e.target.value)}
            placeholder="e.g. Send the site visit quote" /></div>
        <div><span className="label">Client</span>
          <ClientPicker clients={clients} value={form.contact_id} onChange={set("contact_id")} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="task-due">Due date</label>
            <input id="task-due" className="input" type="date" value={form.due_date} onChange={(e) => set("due_date")(e.target.value)} /></div>
          <div><label className="label" htmlFor="task-who">Assignee</label>
            <select id="task-who" className="input" value={form.assigned_to} onChange={(e) => set("assigned_to")(e.target.value)}>
              {options.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="">Unassigned</option>
            </select></div>
          <div><label className="label" htmlFor="task-priority">Priority</label>
            <select id="task-priority" className={`input ${form.priority === "Urgent" ? "font-semibold text-coral" : ""}`}
              value={form.priority} onChange={(e) => set("priority")(e.target.value)}>
              <option value="">Normal</option>
              <option value="Urgent">Urgent</option>
            </select></div>
        </div>
        <p className="-mt-2 text-xs text-muted">Tasks 3+ days overdue count as urgent automatically.</p>
        <div><label className="label" htmlFor="task-note">Note <span className="font-normal normal-case text-faint">(optional)</span></label>
          <textarea id="task-note" className="input min-h-20" value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{editing ? "Save" : "Add task"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** "+ New task" button that opens the form. */
export function NewTaskButton(props: { clients: ClientOption[]; people: string[]; defaultAssignee: string; contactId?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${props.small ? "btn-sm" : "btn-primary"}`} onClick={() => setOpen(true)}>+ New task</button>
      {open && <TaskFormModal clients={props.clients} people={props.people} defaultAssignee={props.defaultAssignee}
        task={{ contact_id: props.contactId }} onClose={() => setOpen(false)} />}
    </>
  );
}
