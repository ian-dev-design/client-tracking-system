"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { journey, type JourneyKey } from "@/lib/journey";
import { moneyShort } from "@/lib/target";
import { ContactActions } from "./ContactActions";
import { DraftOutreachModal } from "./DraftOutreach";
import { postJson } from "./Modal";
import Link from "next/link";
import { Avatar } from "./ui";
import { PersonCard, type Tag } from "./PersonCard";
import { MoveButton } from "./Widgets";

export type BoardCard = {
  id: string; name: string; company: string; owner: string; stage: string; research_status: string;
  contact_type: string; fit: number; value: number; lastTouch: string; overdue: boolean; ready: boolean; hasDraft: boolean;
};

// Short hint shown in an empty column.
const EMPTY_HINT: Record<string, React.ReactNode> = {
  Lead: <>No leads yet — <Link href="/contacts/new" className="link">+ Add contact</Link></>,
  "To Contact": <>No one to contact yet — <Link href="/contacts/new" className="link">+ Add contact</Link></>,
};

function Card({ card, accent, selected, onSelect, showOwner, canOnboard, testRedirect }: {
  card: BoardCard; accent: string; selected: boolean; onSelect: () => void; showOwner: boolean; canOnboard: boolean; testRedirect?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const tags: Tag[] = [];
  if (card.overdue) tags.push({ label: "Follow-up overdue", tone: "alert" });
  if (card.ready) tags.push({ label: "Ready for interview", tone: "ready" });
  if (card.hasDraft) tags.push({ label: "Draft ready", tone: "plain" });
  if (card.value) tags.push({ label: moneyShort(card.value), tone: "plain" });
  if (card.fit) tags.push({ label: `Fit ${card.fit}/5`, tone: "plain" });
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "relative z-10 opacity-90" : ""}`}>
      <PersonCard name={card.name} company={card.company} accent={accent} tags={tags}
        className={selected ? "outline outline-2 outline-forest" : ""}
        aside={
          <input type="checkbox" checked={selected} onChange={onSelect} onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Select ${card.name}`} className={`mt-1 accent-forest ${selected ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`} />
        }
        meta={<>
          {showOwner && <Avatar name={card.owner || "?"} size="sm" />}
          <span className="truncate">{showOwner && `${card.owner || "no owner"} · `}{card.lastTouch}</span>
        </>}
        footer={<>
          {canOnboard && <div className="mt-3"><MoveButton contactId={card.id} name={card.name} to="onboarding" size="sm" /></div>}
          {/* Draft / Log / View show on hover to keep the board calm */}
          <div className="mt-3 hidden border-t border-line pt-3 group-hover:block">
            <ContactActions size="sm" testRedirect={testRedirect}
              contact={{ id: card.id, name: card.name, stage: card.stage, research_status: card.research_status, contact_type: card.contact_type }} />
          </div>
        </>}
      />
    </div>
  );
}

function Column({ stage, count, children }: { stage: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const empty = count === 0;
  return (
    <div ref={setNodeRef} className={`flex flex-col transition-colors ${empty ? "w-36 shrink-0" : "w-60 min-w-48 flex-1"} ${isOver ? "bg-forest/[0.05]" : ""}`}>
      <div className="mb-3 flex items-baseline justify-between border-b border-ink pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">{stage}</span>
        <span className="text-xs tabular-nums text-muted">{count}</span>
      </div>
      <div className="flex min-h-28 flex-col gap-2">
        {empty ? <p className="border border-dashed border-line p-3 text-xs leading-relaxed text-muted">{EMPTY_HINT[stage] || "Drag a card here."}</p> : children}
      </div>
    </div>
  );
}

/** Drag-and-drop board. `field` is which column a card sits in: pipeline stage or research status. */
export function Board({ stages, field, track, initial, showOwner, testRedirect }: {
  stages: string[]; field: "stage" | "research_status"; track: JourneyKey; initial: BoardCard[];
  showOwner: boolean; // false when there's only one owner, so avatars add nothing
  testRedirect?: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const accent = journey(track).border;

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const id = String(active.id);
    const value = String(over.id);
    const card = cards.find((c) => c.id === id);
    if (!card || card[field] === value) return;
    const before = cards;
    setCards(cards.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    try {
      await postJson(`/api/contacts/${id}`, { [field]: value }, "PATCH");
      router.refresh();
    } catch (e) {
      setCards(before);
      setError((e as Error).message);
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={!selected.length} onClick={() => setBulk(true)}>
          Draft outreach for {selected.length || "selected"}
        </button>
        {!!selected.length && <button className="btn" onClick={() => setSelected([])}>Clear</button>}
        <span className="text-xs text-muted">Drag cards between columns. Hover a card for actions.</span>
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
      {/* fixed id keeps server and browser HTML identical */}
      <DndContext id={`board-${field}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const inStage = cards.filter((c) => c[field] === stage);
            return (
              <Column key={stage} stage={stage} count={inStage.length}>
                {inStage.map((c) => (
                  <Card key={c.id} card={c} accent={accent} selected={selected.includes(c.id)} onSelect={() => toggle(c.id)} showOwner={showOwner}
                    canOnboard={field === "stage" && c.stage === "Qualified"} testRedirect={testRedirect} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      {bulk && (
        <DraftOutreachModal contactIds={selected} testRedirect={testRedirect}
          onClose={() => { setBulk(false); setSelected([]); router.refresh(); }} />
      )}
    </>
  );
}
