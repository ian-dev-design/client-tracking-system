// The one urgency flag a board card shows: a red or amber dot plus a few words, or nothing.
// Red = act now (overdue, blocked, at risk). Amber = soon (due today, stuck, renewal coming up).
// Only the single most urgent reason is shown. Amber and red are used for urgency only (no stage uses them).

import { isTrue, daysSince, today } from "@/lib/util";

type Row = Record<string, string>;
export type Urgency = { level: "red" | "amber"; text: string } | null;

const red = (text: string): Urgency => ({ level: "red", text });
const amber = (text: string): Urgency => ({ level: "amber", text });
/** First red reason, else first amber reason, else nothing. */
const pick = (list: Urgency[]): Urgency => list.find((u) => u?.level === "red") || list.find((u) => u?.level === "amber") || null;

/** Follow-up date and open tasks: shared by every board. */
function dueReasons(c: Row, tasks: Row[]): Urgency[] {
  const out: Urgency[] = [];
  const now = today();
  const mine = tasks.filter((t) => t.contact_id === c.id && !isTrue(t.done) && t.due_date);
  const late = [c.next_followup_date, ...mine.map((t) => t.due_date)].filter((d) => d && d < now).sort()[0];
  if (late) out.push(red(`Overdue ${daysSince(late)}d`));
  if (c.next_followup_date === now || mine.some((t) => t.due_date === now)) out.push(amber("Due today"));
  return out;
}

const closed = (c: Row) => c.stage === "Churned / Lost";

/** Research and Outreach cards. */
export function contactUrgency(c: Row, tasks: Row[]): Urgency {
  return closed(c) ? null : pick(dueReasons(c, tasks));
}

/** Onboarding cards: blocked, at risk, overdue, then stuck in a stage, then due today. */
export function onboardingUrgency(c: Row, row: Row | undefined, tasks: Row[], stuck: { days: number; stage: string } | null): Urgency {
  const blockers = (row?.blockers || "").trim();
  return pick([
    blockers ? red(`Blocked: ${blockers.length > 40 ? `${blockers.slice(0, 38)}…` : blockers}`) : null,
    row?.health === "red" ? red("At risk") : null,
    ...dueReasons(c, tasks),
    stuck ? amber(`Stuck ${stuck.days}d in ${stuck.stage}`) : null,
  ]);
}

/** Retention cards: at risk, renewal overdue, overdue work, then renewal soon, then needs attention. */
export function retentionUrgency(c: Row, tasks: Row[], health: { health: string; reason: string }, daysToRenewal: number | null, renewedRecently: boolean): Urgency {
  if (closed(c)) return null;
  const renewal = renewedRecently || daysToRenewal === null ? null
    : daysToRenewal < 0 ? red(`Renewal overdue ${-daysToRenewal}d`)
    : daysToRenewal <= 30 ? amber(daysToRenewal === 0 ? "Renewal today" : `Renewal in ${daysToRenewal}d`) : null;
  return pick([
    health.health === "red" ? red("At risk") : null,
    renewal?.level === "red" ? renewal : null,
    ...dueReasons(c, tasks),
    renewal?.level === "amber" ? renewal : null,
    health.health === "yellow" ? amber(health.reason) : null,
  ]);
}
