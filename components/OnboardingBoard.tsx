"use client";

// Onboarding as a board: one column per stage (config.json → onboardingStages), cards dragged between them.
// Each move is logged with who made it and when (lib/crm.ts → moveOnboardingStage).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { journey, stageShades } from "@/lib/journey";
import type { OnboardingView } from "@/lib/onboarding";
import { moneyShort } from "@/lib/target";
import { postJson } from "./Modal";
import { Column } from "./StageBoard";
import { Avatar, HEALTH_COLOR } from "./ui";
import { toast } from "./Toast";

const HEALTH_LABEL: Record<string, string> = { green: "Healthy", yellow: "Needs attention", red: "At risk" };

function Card({ v }: { v: OnboardingView }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: v.contactId });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => router.push(`/onboarding/${v.contactId}`)} role="link" aria-label={`Open onboarding for ${v.name}`}
      className={`group cursor-pointer border border-l-[3px] border-line border-l-onboarding bg-white p-3 transition-colors hover:bg-surface
        ${isDragging ? "relative z-10 cursor-grabbing opacity-90" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{v.name}</div>
          <div className="truncate text-sm text-muted">{v.company || "—"}</div>
        </div>
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${HEALTH_COLOR[v.health] || HEALTH_COLOR.green}`}
          role="img" aria-label={`Health: ${HEALTH_LABEL[v.health] || "Healthy"}`} title={`Health: ${HEALTH_LABEL[v.health] || "Healthy"}`} />
      </div>
      <div className="mt-2 text-xs text-muted">
        <span className="font-medium text-ink">{v.stageLabel}</span> · {v.done} of {v.total} tasks
        {v.days !== null && <> · <span className="tabular-nums">{v.days}d</span> here</>}
      </div>
      <div className="mt-2.5 flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {v.blockers && <span className="min-w-0 truncate rounded-xs bg-coral/10 px-1.5 py-0.5 text-[11px] font-medium text-coral" title={v.blockers}>Blocked</span>}
          {v.value > 0 && <span className="rounded-xs bg-onboarding/15 px-1.5 py-0.5 text-[11px] font-medium text-onboarding-ink">{moneyShort(v.value)}</span>}
        </div>
        <span title={v.owner ? `Owner: ${v.owner}` : "No owner"}><Avatar name={v.owner || "?"} size="sm" /></span>
      </div>
    </div>
  );
}

export function OnboardingBoard({ stages, initial }: {
  stages: { key: string; label: string; description: string }[]; initial: OnboardingView[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const shades = stageShades(journey("onboarding").hex, stages.length);

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const card = cards.find((c) => c.contactId === String(active.id));
    const to = stages.find((s) => s.key === String(over.id));
    if (!card || !to || card.stageKey === to.key) return;
    const before = cards;
    setCards(cards.map((c) => (c.contactId === card.contactId ? { ...c, stageKey: to.key, stageLabel: to.label, days: 0 } : c)));
    try {
      await postJson("/api/onboarding", { contactId: card.contactId, moveTo: to.key });
      toast(`Moved ${card.name} to ${to.label}`);
      router.refresh();
    } catch (e) {
      setCards(before);
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="mb-5 flex min-h-9 flex-wrap items-center gap-3">
        <span className="text-xs text-muted">Drag a card to move it to another stage. Click a card for its checklist, notes and timeline.</span>
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
      <DndContext id="board-onboarding" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-1.5 overflow-x-auto pb-4">
          {stages.map((s, i) => {
            const inStage = cards.filter((c) => c.stageKey === s.key);
            return (
              <Column key={s.key} id={s.key} label={s.label} index={i} count={inStage.length} shade={shades[i]}
                value={inStage.reduce((sum, c) => sum + c.value, 0)} subtitle={s.description}
                hint={i === 0 ? <>No one is waiting on a handoff. Move a qualified client to Onboarding from the Outreach board.</> : <>{s.description}<br />Drag a card here.</>}>
                {inStage.map((c) => <Card key={c.contactId} v={c} />)}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </>
  );
}
