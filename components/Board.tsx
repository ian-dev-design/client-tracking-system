"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { journey, stageShades, type JourneyKey } from "@/lib/journey";
import type { Urgency } from "@/lib/urgency";
import { moneyShort } from "@/lib/target";
import { DraftOutreachModal } from "./DraftOutreach";
import { LogInteractionModal } from "./LogInteraction";
import { postJson } from "./Modal";
import { Column } from "./StageBoard";
import { Avatar, UrgencyFlag } from "./ui";
import { HandoffModal } from "./Widgets";
import { toast } from "./Toast";

export type BoardCard = {
  id: string; name: string; company: string; owner: string; stage: string; research_status: string;
  contact_type: string; fit: number; value: number; lastTouch: string; overdue: boolean; ready: boolean; hasDraft: boolean;
  urgency: Urgency;
};

type Tag = { label: string; cls: string };
const TAG = {
  ready: "bg-success/10 text-outreach-ink", money: "bg-success/10 text-outreach-ink", plain: "bg-wash text-muted",
};

// What an empty column says, with a next step where there is one.
const EMPTY_HINT: Record<string, React.ReactNode> = {
  Lead: <>No leads yet.<Link href="/contacts/new" className="btn btn-sm mt-2">+ Add your first contact</Link></>,
  "To Contact": <>No one to contact yet.<Link href="/contacts/new" className="btn btn-sm mt-2">+ Add a contact</Link></>,
};

/** "⋯" menu: shows on hover with a mouse, always on touch screens. */
function CardMenu({ card, canOnboard, testRedirect }: { card: BoardCard; canOnboard: boolean; testRedirect?: string }) {
  const [open, setOpen] = useState<"" | "menu" | "draft" | "log" | "onboard">("");
  const contact = { id: card.id, name: card.name, stage: card.stage, research_status: card.research_status, contact_type: card.contact_type };
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation() };
  return (
    <div className="relative" {...stop}>
      <button type="button" aria-label={`Actions for ${card.name}`} onClick={() => setOpen(open === "menu" ? "" : "menu")}
        className={`px-1 text-base leading-none text-muted hover:text-ink ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"}`}>⋯</button>
      {open === "menu" && (
        <div className="absolute right-0 z-20 mt-1 w-44 border border-line bg-white py-1 text-sm" onMouseLeave={() => setOpen("")}>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => setOpen("draft")}>Draft outreach</button>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => setOpen("log")}>Log interaction</button>
          <Link href={`/contacts/${card.id}`} className="block px-3 py-1.5 hover:bg-surface">Open profile</Link>
          {canOnboard && <div className="border-t border-line px-3 pt-2 pb-1"><button className="btn btn-sm btn-primary" onClick={() => setOpen("onboard")}>→ Move to Onboarding</button></div>}
        </div>
      )}
      {open === "draft" && <DraftOutreachModal contactIds={[card.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={contact} onClose={() => setOpen("")} />}
      {open === "onboard" && <HandoffModal contactId={card.id} name={card.name} onClose={() => setOpen("")} />}
    </div>
  );
}

function Card({ card, accent, selected, onSelect, canOnboard, testRedirect }: {
  card: BoardCard; accent: string; selected: boolean; onSelect: () => void; canOnboard: boolean; testRedirect?: string;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  // One row of up to 3 small tags: status first, then value, then fit.
  const tags: Tag[] = [];
  if (card.ready) tags.push({ label: "Ready for interview", cls: TAG.ready });
  if (card.value) tags.push({ label: moneyShort(card.value), cls: TAG.money });
  if (card.fit) tags.push({ label: `Fit ${card.fit}/5`, cls: TAG.plain });
  if (card.hasDraft) tags.push({ label: "Draft ready", cls: TAG.plain });

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => router.push(`/contacts/${card.id}`)} role="link" aria-label={`Open ${card.name}`}
      className={`group cursor-pointer border border-l-[3px] border-line bg-white p-3 transition-colors hover:bg-surface ${accent}
        ${selected ? "outline outline-2 outline-forest" : ""} ${isDragging ? "relative z-10 cursor-grabbing opacity-90" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{card.name}</div>
          <div className="truncate text-sm text-muted">{card.company || "—"}</div>
        </div>
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Select ${card.name}`}
          className={`mt-1 accent-forest ${selected ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"}`} />
        <CardMenu card={card} canOnboard={canOnboard} testRedirect={testRedirect} />
      </div>
      <UrgencyFlag u={card.urgency} className="mt-2" />
      <div className="mt-2.5 flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {tags.slice(0, tags[0]?.label.length > 12 ? 2 : 3).map((t) => <span key={t.label} className={`min-w-0 truncate rounded-xs px-1.5 py-0.5 text-[11px] font-medium ${t.cls}`}>{t.label}</span>)}
        </div>
        <span title={card.owner ? `Owner: ${card.owner}` : "No owner"}><Avatar name={card.owner || "?"} size="sm" /></span>
      </div>
    </div>
  );
}

/** Drag-and-drop board. `field` is which column a card sits in: pipeline stage or research status. */
export function Board({ stages, field, track, initial, testRedirect }: {
  stages: string[]; field: "stage" | "research_status"; track: JourneyKey; initial: BoardCard[];
  showOwner?: boolean; testRedirect?: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const j = journey(track);
  const shades = stageShades(j.hex, stages.length);

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
      toast(`Moved ${card.name} to ${value}`);
      router.refresh();
    } catch (e) {
      setCards(before);
      setError((e as Error).message);
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <div className="mb-5 flex min-h-9 flex-wrap items-center gap-3">
        {selected.length ? <>
          <button className="btn btn-primary" onClick={() => setBulk(true)}>Draft outreach for {selected.length}</button>
          <button className="btn" onClick={() => setSelected([])}>Clear</button>
        </> : <span className="text-xs text-muted">Drag a card to move it. Click to open. Tick cards to draft outreach for several at once.</span>}
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
      {/* fixed id keeps server and browser HTML identical */}
      <DndContext id={`board-${field}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-1.5 overflow-x-auto pb-4">
          {stages.map((stage, i) => {
            const inStage = cards.filter((c) => c[field] === stage);
            return (
              <Column key={stage} id={stage} label={stage} index={i} count={inStage.length} shade={shades[i]}
                value={inStage.reduce((s, c) => s + c.value, 0)} hint={EMPTY_HINT[stage]}>
                {inStage.map((c) => (
                  <Card key={c.id} card={c} accent={j.border} selected={selected.includes(c.id)} onSelect={() => toggle(c.id)}
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
