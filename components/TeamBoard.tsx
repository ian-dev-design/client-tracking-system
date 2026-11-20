"use client";

// Team board: one column per teammate (+ Unassigned for tasks). Drag a card to reassign it.
// Tasks view: cards are open tasks. Clients view: cards are clients, columns are their owners.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { JOURNEY, journey, type JourneyKey } from "@/lib/journey";
import { formatDate } from "@/lib/util";
import { postJson } from "./Modal";
import { TaskFormModal, type ClientOption } from "./TaskForm";
import { HandOffButton } from "./HandOff";
import { NewTaskButton } from "./TaskForm";

export type TeamTaskCard = {
  id: string; title: string; who: string; due_date: string; overdue: boolean; notes: string;
  contact_id: string; client: string; stage: JourneyKey | null; assigned_to: string;
};
export type TeamClientCard = {
  id: string; name: string; company: string; who: string; stage: JourneyKey | null; stageLabel: string;
  overdue: boolean; next_followup_date: string;
};
export type TeamColumn = { key: string; label: string; onTeam: boolean };

type Card = { id: string; who: string; overdue: boolean; stage: JourneyKey | null; text: string };

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "relative z-10 opacity-90" : ""}`}>
      {children}
    </div>
  );
}

function Column({ col, total, overdue, droppable, children }: {
  col: TeamColumn; total: number; overdue: number; droppable: boolean; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, disabled: !droppable });
  return (
    <div ref={setNodeRef} className={`flex w-64 min-w-56 flex-1 flex-col transition-colors ${isOver ? "bg-forest/[0.05]" : ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-ink pb-2">
        <span className={`truncate text-[11px] font-semibold uppercase tracking-[0.08em] ${col.onTeam || !col.key ? "text-ink" : "text-muted"}`}
          title={col.onTeam || !col.key ? undefined : "Not on the team list (ALLOWED_EMAILS)"}>
          {col.label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {overdue > 0 && <span className="mr-2 font-semibold text-coral">{overdue} overdue</span>}
          {total}
        </span>
      </div>
      <div className="flex min-h-28 flex-col gap-2">
        {total ? children : <p className="border border-dashed border-line p-3 text-xs text-muted">{droppable ? "Drag a card here." : "Nothing here."}</p>}
      </div>
    </div>
  );
}

function TaskCard({ t, onOpen }: { t: TeamTaskCard; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}
      className={`block w-full border border-l-[3px] border-line bg-white p-3 text-left transition-colors hover:bg-surface ${t.stage ? journey(t.stage).border : "border-l-line"}`}>
      <div className="text-sm font-medium text-ink">{t.title}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted">{t.client || "No client"}</span>
        {t.due_date && <span className={`shrink-0 tabular-nums ${t.overdue ? "font-semibold text-coral" : "text-muted"}`}>{formatDate(t.due_date)}</span>}
      </div>
    </button>
  );
}

function ClientCard({ c }: { c: TeamClientCard }) {
  return (
    <Link href={`/contacts/${c.id}`} onClick={(e) => e.stopPropagation()}
      className={`block border border-l-[3px] border-line bg-white p-3 transition-colors hover:bg-surface ${c.stage ? journey(c.stage).border : "border-l-line"}`}>
      <div className="truncate text-sm font-medium text-ink">{c.name}</div>
      <div className="truncate text-xs text-muted">{c.company || "—"}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted">{c.stageLabel}</span>
        {c.overdue && <span className="shrink-0 font-semibold text-coral">Follow-up {formatDate(c.next_followup_date)}</span>}
      </div>
    </Link>
  );
}

export function TeamBoard({ view, columns, tasks, clients, clientOptions, people, me }: {
  view: "tasks" | "clients"; columns: TeamColumn[]; tasks: TeamTaskCard[]; clients: TeamClientCard[];
  clientOptions: ClientOption[]; people: string[]; me: string;
}) {
  const router = useRouter();
  const [taskCards, setTaskCards] = useState(tasks);
  const [clientCards, setClientCards] = useState(clients);
  const [stage, setStage] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<TeamTaskCard | null>(null);
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cards: Card[] = view === "tasks"
    ? taskCards.map((t) => ({ id: t.id, who: t.who, overdue: t.overdue, stage: t.stage, text: `${t.title} ${t.client}` }))
    : clientCards.map((c) => ({ id: c.id, who: c.who, overdue: c.overdue, stage: c.stage, text: `${c.name} ${c.company}` }));
  const shown = useMemo(() => {
    const s = q.toLowerCase().trim();
    return new Set(cards.filter((c) => (!stage || c.stage === stage) && (!overdueOnly || c.overdue) && (!s || c.text.toLowerCase().includes(s))).map((c) => c.id));
  }, [cards, stage, overdueOnly, q]);

  // Clients always keep an owner, so in the Clients view only teammate columns accept drops.
  const droppable = (col: TeamColumn) => (view === "tasks" ? col.onTeam || col.key === "" : col.onTeam);

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const id = String(active.id);
    const to = String(over.id).replace(/^col:/, "");
    setError("");
    if (view === "tasks") {
      const card = taskCards.find((t) => t.id === id);
      if (!card || card.who === to) return;
      const before = taskCards;
      setTaskCards(taskCards.map((t) => (t.id === id ? { ...t, who: to, assigned_to: to } : t)));
      try { await postJson(`/api/tasks/${id}`, { assigned_to: to }, "PATCH"); router.refresh(); }
      catch (e) { setTaskCards(before); setError((e as Error).message); }
    } else {
      const card = clientCards.find((c) => c.id === id);
      if (!card || card.who === to || !to) return;
      const before = clientCards;
      setClientCards(clientCards.map((c) => (c.id === id ? { ...c, who: to } : c)));
      try { await postJson(`/api/contacts/${id}`, { owner: to }, "PATCH"); router.refresh(); }
      catch (e) { setClientCards(before); setError((e as Error).message); }
    }
  };

  const visibleCols = columns.filter((col) => view === "tasks" || col.key !== "");
  const tab = (v: "tasks" | "clients", label: string) => (
    <Link href={v === "tasks" ? "/team" : "/team?view=clients"}
      className={`px-3 py-1.5 text-sm ${view === v ? "bg-forest font-semibold text-paper" : "text-muted hover:text-ink"}`}>{label}</Link>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex border border-line bg-white" role="tablist" aria-label="Board view">
          {tab("tasks", "Tasks")}
          {tab("clients", "Clients")}
        </div>
        <div className="ml-auto flex gap-2">
          <HandOffButton columns={columns} tasks={taskCards} clients={clientCards} />
          <NewTaskButton clients={clientOptions} people={people} defaultAssignee={me} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 border-y border-line py-3">
        <input className="input max-w-60" placeholder={view === "tasks" ? "Search tasks or clients…" : "Search clients…"}
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-44" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {JOURNEY.map((j) => <option key={j.key} value={j.key}>{j.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="accent-forest" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue only
        </label>
        <span className="text-xs text-muted">Drag a card to another person to reassign it.</span>
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>

      <DndContext id={`team-${view}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto pb-4">
          {visibleCols.map((col) => {
            const inCol = cards.filter((c) => c.who === col.key);
            const visible = inCol.filter((c) => shown.has(c.id));
            return (
              <Column key={col.key || "_unassigned"} col={col} total={visible.length} overdue={inCol.filter((c) => c.overdue).length} droppable={droppable(col)}>
                {visible.map((c) => (
                  <Draggable key={c.id} id={c.id}>
                    {view === "tasks"
                      ? <TaskCard t={taskCards.find((t) => t.id === c.id)!} onOpen={() => setEditing(taskCards.find((t) => t.id === c.id)!)} />
                      : <ClientCard c={clientCards.find((x) => x.id === c.id)!} />}
                  </Draggable>
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      {editing && (
        <TaskFormModal clients={clientOptions} people={people} defaultAssignee={me} onClose={() => setEditing(null)}
          task={{ id: editing.id, title: editing.title, contact_id: editing.contact_id, due_date: editing.due_date, assigned_to: editing.assigned_to, notes: editing.notes }} />
      )}
    </>
  );
}
