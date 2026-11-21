"use client";

// Team → Workload: a row of teammate cards (filters and drop targets) above one task list
// grouped Overdue / Today / Upcoming (Completed folded away). Clients mode lists clients by stage instead.
// Three ways to reassign: the dropdown on a row, tick rows and use the bar, or drag a row onto a teammate card.
// Every reassignment is logged; a bulk reassign sends one notification per person (lib/crm.ts → bulkReassign).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, pointerWithin, useDndContext, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { JOURNEY, journey, type JourneyKey } from "@/lib/journey";
import type { Urgency } from "@/lib/urgency";
import { formatDate } from "@/lib/util";
import { postJson } from "./Modal";
import { TaskFormModal, type ClientOption } from "./TaskForm";
import { Avatar, Spinner, UrgencyFlag } from "./ui";
import { toast } from "./Toast";

export type TeamColumn = { key: string; label: string; onTeam: boolean };
export type TeamTaskCard = {
  id: string; title: string; who: string; assigned_to: string; due_date: string; overdue: boolean; notes: string; priority: string;
  contact_id: string; client: string; stage: JourneyKey | null; urgency: Urgency; done: boolean; completedAt: string;
  group: "overdue" | "today" | "upcoming" | "done";
};
export type TeamClientCard = {
  id: string; name: string; company: string; who: string; stage: JourneyKey | null; stageLabel: string;
  overdue: boolean; next_followup_date: string; urgency: Urgency;
};

// ---------- Teammate cards ----------

export type CardStats = { open: number; overdue: number; share: number };

/** One teammate (or "Everyone" / "Unassigned"): avatar, name, open count, overdue (only if any), workload bar. */
export function PersonCardBody({ label, stats, selected, everyone = false, unit = "open" }: {
  label: string; stats: CardStats; selected: boolean; everyone?: boolean; unit?: string;
}) {
  const overduePart = stats.open ? (stats.overdue / stats.open) * 100 : 0;
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {everyone ? <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[11px] font-semibold text-muted">All</span>
          : <Avatar name={label === "Unassigned" ? "?" : label.replace(/ \(you\)$/, "")} />}
        <span className={`truncate text-sm ${selected ? "font-semibold text-forest" : "font-medium text-ink"}`}>{label}</span>
      </span>
      <span className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span><span className="font-semibold tabular-nums text-ink">{stats.open}</span> <span className="text-muted">{unit}</span></span>
        {stats.overdue > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-coral">
            <span className="h-2 w-2 rounded-full bg-current text-urgent motion-safe:animate-glow" aria-hidden />{stats.overdue} overdue
          </span>
        )}
      </span>
      <span className="mt-2.5 block h-1.5 w-full bg-wash" title={everyone ? undefined : `${Math.round(stats.share * 100)}% of the team's ${unit} work`}>
        <span className="flex h-full bg-forest/45" style={{ width: `${(everyone ? 1 : stats.share) * 100}%` }}>
          <span className="ml-auto block h-full bg-urgent" style={{ width: `${overduePart}%` }} />
        </span>
      </span>
    </>
  );
}

const CARD = "flex min-h-[7.25rem] flex-col border bg-white p-3 text-left transition-colors";
const cardTone = (selected: boolean) => (selected ? "border-forest bg-forest/[0.04] shadow-[inset_0_0_0_1px_var(--color-forest)]" : "border-line hover:bg-surface");

/** A teammate card that also accepts dropped rows (highlighted while something is being dragged). */
function DropPersonCard({ id, label, stats, selected, onClick, droppable, unit }: {
  id: string; label: string; stats: CardStats; selected: boolean; onClick: () => void; droppable: boolean; unit: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `person:${id}`, disabled: !droppable });
  const { active } = useDndContext();
  const ring = droppable && active ? (isOver ? "outline-2 outline-dashed outline-forest bg-forest/[0.07]" : "outline-1 outline-dashed outline-forest/50") : "";
  return (
    <button ref={setNodeRef} type="button" onClick={onClick} aria-pressed={selected} className={`${CARD} ${cardTone(selected)} ${ring}`}>
      <PersonCardBody label={label} stats={stats} selected={selected} unit={unit} />
    </button>
  );
}

/** The card row: Everyone first, then each person. Scrolls sideways on a phone. */
export function PersonGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid auto-cols-[minmax(10.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">{children}</div>;
}
export function EveryoneCard({ stats, selected, onClick, unit = "open" }: { stats: CardStats; selected: boolean; onClick: () => void; unit?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${CARD} ${cardTone(selected)}`}>
      <PersonCardBody label="Everyone" stats={stats} selected={selected} everyone unit={unit} />
    </button>
  );
}

// ---------- Rows ----------

const Handle = (props: React.HTMLAttributes<HTMLButtonElement> & { innerRef: (el: HTMLElement | null) => void }) => {
  const { innerRef, ...rest } = props;
  return (
    <button ref={innerRef} type="button" aria-label="Drag onto a teammate to reassign" {...rest}
      className="hidden shrink-0 cursor-grab touch-none px-0.5 text-faint hover:text-ink active:cursor-grabbing sm:block">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
        {[3, 8, 13].flatMap((y) => [2, 8].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
      </svg>
    </button>
  );
};

function Row({ id, canDrag, disabled, selected, onSelect, stage, children }: {
  id: string; canDrag: boolean; disabled: boolean; selected: boolean; onSelect: () => void; stage: JourneyKey | null; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canDrag || disabled });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <li ref={setNodeRef} style={style}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-2 py-2.5 sm:flex-nowrap ${selected ? "bg-forest/[0.04]" : "bg-white"}
        ${isDragging ? "relative z-20 border border-forest shadow-none opacity-95" : ""}`}>
      <input type="checkbox" className="h-4 w-4 shrink-0 accent-forest" checked={selected} disabled={disabled} onChange={onSelect} aria-label="Select" />
      {canDrag && !disabled && <Handle innerRef={setActivatorNodeRef} {...listeners} {...attributes} />}
      <span className={`h-8 w-[3px] shrink-0 ${stage ? journey(stage).bg : "bg-line"}`} title={stage ? journey(stage).label : "No stage"} aria-hidden />
      {children}
    </li>
  );
}

const AssignSelect = ({ value, people, me, onChange, allowNone, label, busy }: {
  value: string; people: string[]; me: string; onChange: (v: string) => void; allowNone: boolean; label: string; busy: boolean;
}) => (
  <select className="input ml-auto w-auto max-w-36 shrink-0 py-1 text-xs" value={value} disabled={busy} aria-label={label}
    onChange={(e) => onChange(e.target.value)}>
    {(value && !people.includes(value) ? [...people, value] : people).map((p) => <option key={p} value={p}>{p === me ? `${p} (you)` : p}</option>)}
    {allowNone && <option value="">Unassigned</option>}
  </select>
);

// ---------- The Workload view ----------

export function TeamWorkload({ view, people, tasks, clients, clientOptions, names, me, initialWho }: {
  view: "tasks" | "clients"; people: TeamColumn[]; tasks: TeamTaskCard[]; clients: TeamClientCard[];
  clientOptions: ClientOption[]; names: string[]; me: string; initialWho?: string | null;
}) {
  const router = useRouter();
  const [taskItems, setTaskItems] = useState(tasks);
  const [clientItems, setClientItems] = useState(clients);
  useEffect(() => setTaskItems(tasks), [tasks]);
  useEffect(() => setClientItems(clients), [clients]);
  const [who, setWho] = useState<string | null>(initialWho ?? null); // null = Everyone
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TeamTaskCard | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  useEffect(() => setCanDrag(window.matchMedia("(hover: hover) and (pointer: fine)").matches), []); // no drag on touch screens
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const isTasks = view === "tasks";

  // Card numbers: open tasks (or clients owned) and overdue, as a share of the team's.
  const open = isTasks ? taskItems.filter((t) => !t.done) : clientItems;
  const statsFor = (key: string): CardStats => {
    const mine = open.filter((x) => x.who === key);
    return { open: mine.length, overdue: mine.filter((x) => (isTasks ? (x as TeamTaskCard).overdue : x.urgency?.level === "red")).length, share: open.length ? mine.length / open.length : 0 };
  };
  const cardPeople = people.filter((p) => isTasks || p.key !== ""); // clients always have an owner
  const unit = isTasks ? "open" : "clients";

  const reassign = async (ids: string[], to: string) => {
    if (!isTasks && !to) return setError("Clients need an owner.");
    setError(""); setBusy(ids.join(","));
    const before = { taskItems, clientItems };
    if (isTasks) setTaskItems(taskItems.map((t) => (ids.includes(t.id) ? { ...t, who: to, assigned_to: to } : t)));
    else setClientItems(clientItems.map((c) => (ids.includes(c.id) ? { ...c, who: to } : c)));
    try {
      if (ids.length > 1) await postJson("/api/team/reassign", { kind: view, ids, to });
      else if (isTasks) await postJson(`/api/tasks/${ids[0]}`, { assigned_to: to }, "PATCH");
      else await postJson(`/api/contacts/${ids[0]}`, { owner: to }, "PATCH");
      toast(`${ids.length > 1 ? `${ids.length} ${isTasks ? "tasks" : "clients"}` : "Reassigned"} to ${to || "Unassigned"}`);
      setPicked([]);
      router.refresh();
    } catch (e) { setTaskItems(before.taskItems); setClientItems(before.clientItems); setError((e as Error).message); }
    finally { setBusy(""); }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || !String(over.id).startsWith("person:")) return;
    const to = String(over.id).slice("person:".length);
    const id = String(active.id);
    const ids = picked.includes(id) && picked.length > 1 ? picked : [id];
    const current = ids.filter((x) => (isTasks ? taskItems.find((t) => t.id === x)?.who : clientItems.find((c) => c.id === x)?.who) !== to);
    if (current.length) reassign(current, to);
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const visibleTasks = taskItems.filter((t) => who === null || t.who === who);
  const visibleClients = clientItems.filter((c) => who === null || c.who === who);
  const whoLabel = who === null ? "" : people.find((p) => p.key === who)?.label || who || "Unassigned";

  const taskRow = (t: TeamTaskCard) => (
    <Row key={t.id} id={t.id} canDrag={canDrag} disabled={t.done} selected={picked.includes(t.id)} onSelect={() => toggle(t.id)} stage={t.stage}>
      <div className="min-w-0 basis-[calc(100%-5rem)] sm:flex-1 sm:basis-auto">
        <button type="button" onClick={() => setEditing(t)} className={`block max-w-full truncate text-left text-sm font-medium hover:underline ${t.done ? "text-faint line-through" : "text-ink"}`}>{t.title}</button>
        <div className="truncate text-xs text-muted">
          {t.contact_id ? <Link href={`/contacts/${t.contact_id}`} className="hover:text-ink hover:underline">{t.client}</Link> : "No client"}
        </div>
      </div>
      <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{t.done ? `Done ${formatDate(t.completedAt)}` : t.due_date ? formatDate(t.due_date) : "No due date"}</span>
      <span className="w-32 shrink-0"><UrgencyFlag u={t.done ? null : t.urgency} /></span>
      {busy.split(",").includes(t.id) && <Spinner />}
      {!t.done && <AssignSelect value={t.assigned_to} people={names} me={me} allowNone label={`Assignee for "${t.title}"`} busy={!!busy}
        onChange={(v) => reassign([t.id], v)} />}
    </Row>
  );
  const clientRow = (c: TeamClientCard) => (
    <Row key={c.id} id={c.id} canDrag={canDrag} disabled={false} selected={picked.includes(c.id)} onSelect={() => toggle(c.id)} stage={c.stage}>
      <div className="min-w-0 basis-[calc(100%-5rem)] sm:flex-1 sm:basis-auto">
        <Link href={`/contacts/${c.id}`} className="block truncate text-sm font-medium text-ink hover:underline">{c.name}</Link>
        <div className="truncate text-xs text-muted">{c.company || "—"}</div>
      </div>
      <span className="w-32 shrink-0 truncate text-xs text-muted">{c.stageLabel}</span>
      <span className="w-32 shrink-0"><UrgencyFlag u={c.urgency} /></span>
      {busy.split(",").includes(c.id) && <Spinner />}
      <AssignSelect value={c.who} people={names} me={me} allowNone={false} label={`Owner of ${c.name}`} busy={!!busy} onChange={(v) => reassign([c.id], v)} />
    </Row>
  );
  const group = (title: string, rows: React.ReactNode[], tone = "text-muted") => rows.length > 0 && (
    <section className="mb-6" key={title}>
      <h3 className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${tone}`}>{title} · {rows.length}</h3>
      <ul className="border-t border-line">{rows}</ul>
    </section>
  );

  // collisionDetection = pointerWithin: the card under the pointer wins (rows are wide, so overlap-based detection picks the wrong card).
  return (
    <DndContext id="team-workload" sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <PersonGrid>
        <EveryoneCard stats={{ open: open.length, overdue: cardPeople.reduce((a, p) => a + statsFor(p.key).overdue, 0), share: 1 }} selected={who === null} onClick={() => setWho(null)} unit={unit} />
        {cardPeople.map((p) => (
          <DropPersonCard key={p.key || "_none"} id={p.key} label={p.label} stats={statsFor(p.key)} unit={unit}
            selected={who === p.key} onClick={() => setWho(who === p.key ? null : p.key)} droppable={(p.onTeam || p.key === "") && (isTasks || p.key !== "")} />
        ))}
      </PersonGrid>

      <div className="mt-8 mb-4 flex min-h-9 flex-wrap items-center gap-3">
        <div className="flex border border-line bg-white" role="tablist" aria-label="Show">
          {(["tasks", "clients"] as const).map((v) => (
            <Link key={v} href={v === "tasks" ? "/team" : "/team?view=clients"} role="tab" aria-selected={view === v}
              className={`px-3 py-1.5 text-sm ${view === v ? "bg-forest font-semibold text-paper" : "text-muted hover:text-ink"}`}>{v === "tasks" ? "Tasks" : "Clients"}</Link>
          ))}
        </div>
        <span className="text-sm text-muted">{who === null ? `Everyone's ${isTasks ? "tasks" : "clients"}` : `${isTasks ? "Tasks" : "Clients"} for ${whoLabel}`}</span>
        {canDrag && <span className="hidden text-xs text-faint md:inline">Drag a row by its handle onto a teammate to reassign it.</span>}
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>

      {picked.length > 0 && (
        <div className="sticky top-0 z-30 mb-4 flex flex-wrap items-center gap-3 border border-forest bg-paper px-3 py-2 text-sm md:top-2">
          <span className="font-semibold text-ink">{picked.length} selected</span>
          <span className="text-faint" aria-hidden>·</span>
          <label className="flex items-center gap-2">
            Reassign to
            <select className="input w-auto py-1 text-sm" value="__" disabled={!!busy} onChange={(e) => e.target.value !== "__" && reassign(picked, e.target.value)}>
              <option value="__" disabled>Pick a person…</option>
              {names.map((p) => <option key={p} value={p}>{p === me ? `${p} (you)` : p}</option>)}
              {isTasks && <option value="">Unassigned</option>}
            </select>
          </label>
          <span className="text-faint" aria-hidden>·</span>
          <button type="button" className="text-sm font-medium text-info hover:underline" onClick={() => setPicked([])}>Clear</button>
          {busy && <Spinner />}
        </div>
      )}

      {isTasks ? (<>
        {group("Overdue", visibleTasks.filter((t) => t.group === "overdue").map(taskRow), "text-coral")}
        {group("Today", visibleTasks.filter((t) => t.group === "today").map(taskRow), "text-amber-ink")}
        {group("Upcoming", visibleTasks.filter((t) => t.group === "upcoming").map(taskRow))}
        {!visibleTasks.some((t) => !t.done) && <p className="muted mb-6">No open tasks{whoLabel ? ` for ${whoLabel}` : ""}. Use + New task to add one.</p>}
        {visibleTasks.some((t) => t.done) && (
          <details className="mb-6">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink">Completed (last 14 days) · {visibleTasks.filter((t) => t.done).length}</summary>
            <ul className="mt-2 border-t border-line">{visibleTasks.filter((t) => t.done).map(taskRow)}</ul>
          </details>
        )}
      </>) : (<>
        {JOURNEY.map((j) => group(j.label, visibleClients.filter((c) => c.stage === j.key).map(clientRow)))}
        {group("No stage", visibleClients.filter((c) => !c.stage).map(clientRow))}
        {!visibleClients.length && <p className="muted">No clients{whoLabel ? ` owned by ${whoLabel}` : ""}.</p>}
      </>)}

      {editing && (
        <TaskFormModal clients={clientOptions} people={names} defaultAssignee={me} onClose={() => setEditing(null)}
          task={{ id: editing.id, title: editing.title, contact_id: editing.contact_id, due_date: editing.due_date, assigned_to: editing.assigned_to, notes: editing.notes, priority: editing.priority }} />
      )}
    </DndContext>
  );
}
