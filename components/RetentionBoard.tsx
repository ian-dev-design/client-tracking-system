"use client";

// Retention boards. Two views over the same clients:
//   health    Healthy / Needs attention / At risk. Health is calculated; dragging sets a manual override with a reason
//             (shown on the card as "Manual: <reason> ×", which clears it).
//   renewals  90+ days / 60 days / 30 days / Overdue / Renewed / Churned. Renewed asks for the next date; Churned asks why.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { journey, stageShades } from "@/lib/journey";
import { bucketDefaultDays } from "@/lib/retention";
import { moneyShort } from "@/lib/target";
import type { Urgency } from "@/lib/urgency";
import { addDays, formatDate, today } from "@/lib/util";
import { Modal, postJson } from "./Modal";
import { RetentionMenu } from "./RetentionCard";
import { Column } from "./StageBoard";
import { Avatar, UrgencyFlag } from "./ui";
import { toast } from "./Toast";

export type RetentionCardView = {
  id: string; name: string; company: string; owner: string; stage: string; research_status: string; contact_type: string;
  daysQuiet: number | null; renewalDate: string; daysToRenewal: number | null; value: number;
  health: string; autoHealth: string; autoReason: string; manual: boolean; reason: string; bucket: string; churnReason: string; lastRenewed: string;
  urgency: Urgency; nextStep: string;
};
type Col = { key: string; label: string; dot?: string; hint?: string };

const HEALTH_NAME: Record<string, string> = { green: "Healthy", yellow: "Needs attention", red: "At risk" };

function Card({ v, mode, onClear, testRedirect }: { v: RetentionCardView; mode: "health" | "renewals"; onClear: () => void; testRedirect?: string }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: v.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const churned = v.bucket === "churned";
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => router.push(`/contacts/${v.id}`)} role="link" aria-label={`Open ${v.name}`}
      className={`group cursor-pointer border border-l-[3px] border-line border-l-retention bg-white p-3 transition-colors hover:bg-surface
        ${churned ? "opacity-75" : ""} ${isDragging ? "relative z-10 cursor-grabbing opacity-90" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{v.name}</div>
          <div className="truncate text-sm text-muted">{v.company || "—"}</div>
        </div>
        <RetentionMenu contact={{ id: v.id, name: v.name, stage: v.stage, research_status: v.research_status, contact_type: v.contact_type }}
          churned={churned} testRedirect={testRedirect} />
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-muted">
        {churned ? <div>Churned: {v.churnReason || "no reason given"}</div> : mode === "health" ? <>
          <div>{v.daysQuiet === null ? "Never contacted" : v.daysQuiet === 0 ? "Contacted today" : `Last contact ${v.daysQuiet}d ago`}</div>
          <div>{v.renewalDate ? `Renews ${formatDate(v.renewalDate)}` : "No renewal date"}</div>
        </> : <>
          <div className="font-medium text-ink">
            {v.bucket === "renewed" && v.lastRenewed ? <>Renewed {formatDate(v.lastRenewed)} · next {formatDate(v.renewalDate)}</>
              : v.renewalDate ? <>Renews {formatDate(v.renewalDate)}</> : "No renewal date"}
          </div>
          {v.nextStep && <div className="truncate" title={v.nextStep}>Next: {v.nextStep}</div>}
        </>}
      </div>

      {!churned && <UrgencyFlag u={v.urgency} className="mt-2" />}

      <div className="mt-2.5 flex items-center gap-1.5">
        <span title={v.owner ? `Owner: ${v.owner}` : "No owner"}><Avatar name={v.owner || "?"} size="sm" /></span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{v.owner || "No owner"}</span>
        {mode === "health" && v.manual && (
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClear(); }}
            title={`Set by hand: ${v.reason}. Calculated: ${HEALTH_NAME[v.autoHealth]} (${v.autoReason}). Click to clear.`}
            className="max-w-28 truncate rounded-xs border border-dashed border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-ink hover:text-ink">
            Manual ×
          </button>
        )}
        {v.value > 0 && <span className="rounded-xs bg-retention/12 px-1.5 py-0.5 text-[11px] font-medium text-retention-ink">{moneyShort(v.value)}</span>}
      </div>
      {mode === "health" && v.manual && <p className="mt-1.5 truncate text-[11px] text-faint" title={v.reason}>Why: {v.reason}</p>}
    </div>
  );
}

/** Asks for the next renewal date after a drag. */
function DateModal({ title, note, initial, onSave, onClose }: { title: string; note: string; initial: string; onSave: (d: string) => Promise<void>; onClose: () => void }) {
  const [date, setDate] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(date); } finally { setBusy(false); } }}>
        <p className="mb-4 text-sm text-muted">{note}</p>
        <label className="label" htmlFor="renewal-date">Next renewal date</label>
        <input id="renewal-date" type="date" className="input w-auto" required value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !date}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** Asks why health is being set by hand. */
function ReasonModal({ card, to, onSave, onClose }: { card: RetentionCardView; to: Col; onSave: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Set ${card.name} to ${to.label}`} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(reason.trim()); } finally { setBusy(false); } }}>
        <p className="mb-4 text-sm text-muted">Calculated: <b>{HEALTH_NAME[card.autoHealth]}</b> ({card.autoReason}). Setting it by hand overrides that until you clear it.</p>
        <label className="label" htmlFor="health-reason">Why?</label>
        <input id="health-reason" className="input" required autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Talked at the board meeting; they're happy" />
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !reason.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function RetentionBoard({ mode, columns, initial, testRedirect }: {
  mode: "health" | "renewals"; columns: Col[]; initial: RetentionCardView[]; testRedirect?: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<{ card: RetentionCardView; to: Col; kind: "date" | "reason" } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const shades = stageShades(journey("retention").hex, columns.length);
  const colOf = (c: RetentionCardView) => (mode === "health" ? c.health : c.bucket);

  const patch = async (card: RetentionCardView, body: Record<string, string>, local: Partial<RetentionCardView>, done: string) => {
    const before = cards;
    setCards(cards.map((c) => (c.id === card.id ? { ...c, ...local } : c)));
    setError("");
    try {
      await postJson(`/api/contacts/${card.id}`, body, "PATCH");
      toast(done);
      router.refresh();
    } catch (e) { setCards(before); setError((e as Error).message); }
  };
  const clearOverride = (c: RetentionCardView) =>
    patch(c, { health_override: "", health_reason: "" }, { health: c.autoHealth, manual: false, reason: c.autoReason }, `${c.name} is back to calculated health`);

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    const to = columns.find((c) => c.key === String(over.id));
    if (!card || !to || colOf(card) === to.key) return;
    if (mode === "health") {
      if (to.key === card.autoHealth) return clearOverride(card); // dropping on the calculated column clears the override
      return setAsk({ card, to, kind: "reason" });
    }
    if (card.bucket === "churned") return setError("Churned clients can be brought back from their profile (change the stage).");
    if (to.key === "churned") {
      const reason = prompt(`Why did ${card.name} churn? (required)`);
      if (!reason?.trim()) return;
      return patch(card, { stage: "Churned / Lost", lost_reason: reason.trim() }, { bucket: "churned", churnReason: reason.trim() }, `Marked ${card.name} as churned`);
    }
    if (to.key === "overdue") return setError("Overdue comes from the renewal date. Drag to Renewed when they renew.");
    if (card.bucket === "renewed") return setError(`${card.name} already renewed. Change the next renewal date on their profile.`);
    setAsk({ card, to, kind: "date" });
  };

  const saveDate = async (date: string) => {
    if (!ask) return;
    const { card, to } = ask;
    setAsk(null);
    if (to.key === "renewed") {
      await patch(card, { action: "renew", renewal_date: date }, { bucket: "renewed", renewalDate: date, lastRenewed: today(), urgency: null }, `${card.name} renewed until ${formatDate(date)}`);
    } else {
      const days = Math.round((new Date(date + "T12:00:00").getTime() - new Date(today() + "T12:00:00").getTime()) / 86_400_000);
      const bucket = days < 0 ? "overdue" : days <= 30 ? "30" : days <= 60 ? "60" : "90";
      await patch(card, { renewal_date: date }, { renewalDate: date, daysToRenewal: days, bucket }, `Renewal date for ${card.name}: ${formatDate(date)}`);
    }
  };
  const saveReason = async (reason: string) => {
    if (!ask) return;
    const { card, to } = ask;
    setAsk(null);
    await patch(card, { health_override: to.key, health_reason: reason }, { health: to.key, manual: true, reason }, `${card.name} set to ${to.label} by hand`);
  };

  return (
    <>
      <div className="mb-5 flex min-h-9 flex-wrap items-center gap-3">
        <span className="text-xs text-muted">{mode === "health"
          ? "Health is calculated from last contact, overdue tasks, open issues and the renewal date. Drag a card to set it by hand (you'll be asked why); “Manual ×” clears it."
          : "Columns follow the renewal date. Drag to Renewed when a client renews, or to Churned if they leave. Click a card to open the client."}</span>
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
      <DndContext id={`board-retention-${mode}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-1.5 overflow-x-auto pb-4">
          {columns.map((col, i) => {
            const inCol = cards.filter((c) => colOf(c) === col.key);
            return (
              <Column key={col.key} id={col.key} label={col.label} index={i} count={inCol.length} shade={shades[i]} dot={col.dot} narrow={columns.length > 5}
                value={col.key === "churned" ? 0 : inCol.reduce((s, c) => s + c.value, 0)} hint={col.hint}>
                {inCol.map((c) => <Card key={c.id} v={c} mode={mode} testRedirect={testRedirect} onClear={() => clearOverride(c)} />)}
              </Column>
            );
          })}
        </div>
      </DndContext>
      {ask?.kind === "date" && (
        <DateModal title={ask.to.key === "renewed" ? `${ask.card.name} renewed` : `Renewal date for ${ask.card.name}`}
          note={ask.to.key === "renewed" ? "Great. When is the next renewal?" : `Moving to “${ask.to.label}” sets a new renewal date.`}
          initial={addDays(today(), bucketDefaultDays[ask.to.key] ?? 30)} onSave={saveDate} onClose={() => setAsk(null)} />
      )}
      {ask?.kind === "reason" && <ReasonModal card={ask.card} to={ask.to} onSave={saveReason} onClose={() => setAsk(null)} />}
    </>
  );
}
