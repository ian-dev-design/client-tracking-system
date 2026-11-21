// Everything the Insights page (and the small charts on the stage pages) shows, computed from loaded data.
// Each section returns its numbers plus one plain-language takeaway. No AI involved.

import type { AllData } from "@/lib/crm";
import { isProspect } from "@/lib/crm";
import type { Slice } from "@/components/charts";
import { ONBOARDING_STAGES, currentStage, daysInStage, daysToFirstValue, enteredCol, stageDurations } from "@/lib/onboarding";
import { HEALTH_COLUMNS, clientHealth } from "@/lib/retention";
import { parseStamp } from "@/lib/util";

type Row = Record<string, string>;

export type RangeKey = "30d" | "90d" | "12m" | "all";
export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "12m", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
];
export const rangeKey = (v?: string): RangeKey => (RANGES.some((r) => r.key === v) ? (v as RangeKey) : "90d");

const DAY = 86_400_000;
function rangeStart(key: RangeKey, now: Date): Date | null {
  const days = RANGES.find((r) => r.key === key)?.days;
  return days ? new Date(now.getTime() - days * DAY) : null;
}
const at = (s: string) => (s ? parseStamp(s.length === 10 ? `${s} 09:00` : s) : null);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** A color mixed toward white: p = 100 is the full color. */
export const tint = (hex: string, p: number) => `color-mix(in srgb, ${hex} ${p}%, #ffffff)`;

function historyByContact(history: Row[], track: string) {
  const m = new Map<string, Row[]>();
  for (const h of history.filter((x) => x.track === track).sort((a, b) => a.at.localeCompare(b.at))) {
    m.set(h.contact_id, [...(m.get(h.contact_id) || []), h]);
  }
  return m;
}

// ---------- Outreach funnel ----------

export const FUNNEL_STEPS = ["Contacted", "Responded", "Interview / meeting", "Onboarding", "Retained"] as const;
const SHORT: Record<string, string> = { "Interview / meeting": "Interview" };
const short = (s: string) => SHORT[s] || s;
/** Funnel position of a pipeline stage: Outreach = contacted, Survey Completed = responded, and so on. Lead isn't contacted yet. */
function funnelIndex(stage: string): number {
  return ({ Outreach: 0, "Survey Completed": 1, "Client Interview": 2, Qualified: 2, Onboarding: 3, "Active / Retention": 4 } as Record<string, number>)[stage] ?? -1;
}

export type FunnelStep = { label: string; count: number; pctPrev: number; pctStart: number; drop: boolean; stillHere: number };

/**
 * Contacted → Responded → Interview / meeting → Onboarding → Retained.
 * A contact counts at every step up to the furthest one they ever reached: from stage history, their current stage,
 * a survey (responded) or an interview / meeting logged (met), or a won deal (onboarding). So the funnel doesn't
 * shrink as people move on. The range picks people first contacted in that period.
 */
export function funnel(data: AllData, range: RangeKey, now = new Date()) {
  const start = rangeStart(range, now);
  const hist = historyByContact(data.stageHistory, "pipeline");
  const logged = new Map<string, number>();
  for (const i of data.interactions) {
    const n = i.type === "survey" ? 1 : i.type === "interview" || i.type === "meeting" ? 2 : -1;
    if (n > (logged.get(i.contact_id) ?? -1)) logged.set(i.contact_id, n);
  }
  const people = data.contacts.filter((c) => isProspect(c) || c.stage).map((c) => {
    const h = hist.get(c.id) || [];
    const furthest = Math.max(funnelIndex(c.stage), ...h.map((x) => funnelIndex(x.to_stage)), c.deal_status === "won" ? 3 : -1, logged.get(c.id) ?? -1);
    const firstContact = h.find((x) => funnelIndex(x.to_stage) >= 0)?.at || c.created_at;
    // Still working through their furthest step (not dropped out): they haven't had the chance to convert yet.
    const open = c.stage !== "Churned / Lost" && funnelIndex(c.stage) === furthest;
    return { furthest, firstContact, open };
  }).filter((p) => p.furthest >= 0 && (!start || (p.firstContact && at(p.firstContact)! >= start)));
  const counts = FUNNEL_STEPS.map((_, i) => people.filter((p) => p.furthest >= i).length);
  const stillAt = FUNNEL_STEPS.map((_, i) => people.filter((p) => p.furthest === i && p.open).length);
  // Step-to-step conversion counts only people who finished the step before (moved on or dropped out),
  // so clients still mid-onboarding don't look like a drop. Biggest drop = the lowest of those conversions.
  const decided = (i: number) => counts[i - 1] - stillAt[i - 1];
  let dropAt = -1, dropShare = 0;
  counts.forEach((n, i) => {
    if (!i || decided(i) <= 0) return;
    const share = (decided(i) - n) / decided(i);
    if (share > dropShare) { dropShare = share; dropAt = i; }
  });
  const steps: FunnelStep[] = FUNNEL_STEPS.map((label, i) => ({
    label, count: counts[i], pctPrev: i ? pct(counts[i], decided(i)) : 100, pctStart: pct(counts[i], counts[0]), drop: i === dropAt, stillHere: stillAt[i],
  }));
  const enough = counts[0] >= 3;
  const dropLabel = dropAt > 0 ? `${short(FUNNEL_STEPS[dropAt - 1])} → ${short(FUNNEL_STEPS[dropAt])}` : "";
  const takeaway = !enough ? "" : `${steps[1].pctStart}% of the people contacted respond and ${steps[4].pctStart}% have become retained clients so far; `
    + (dropAt > 0 ? `the biggest drop is ${dropLabel} (${Math.round(dropShare * 100)}% don't continue).` : "no step loses anyone.");
  return { steps, enough, total: counts[0], takeaway, dropLabel };
}

// ---------- Retention ----------

type Span = { c: Row; from: Date; churn: Date | null };

/** When each client became active, and when (if) they churned. */
function clientSpans(data: AllData): Span[] {
  const hist = historyByContact(data.stageHistory, "pipeline");
  const spans: Span[] = [];
  for (const c of data.contacts) {
    const h = hist.get(c.id) || [];
    const fromStr = h.find((x) => x.to_stage === "Active / Retention")?.at
      || data.retention.find((r) => r.contact_id === c.id)?.active_since
      || (c.stage === "Active / Retention" ? c.created_at : "");
    const from = at(fromStr);
    if (!from) continue;
    let churn: Date | null = null;
    if (c.stage === "Churned / Lost") churn = at([...h].reverse().find((x) => x.to_stage === "Churned / Lost")?.at || c.updated_at) || null;
    spans.push({ c, from, churn });
  }
  return spans;
}
const activeOn = (s: Span, t: Date) => s.from <= t && (!s.churn || s.churn > t);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Retention rate = clients active at the start of the period who are still active at the end. */
export function retention(data: AllData, range: RangeKey, now = new Date()) {
  const spans = clientSpans(data);
  const start = rangeStart(range, now);
  const cohort = start ? spans.filter((s) => activeOn(s, start)) : spans;
  const still = cohort.filter((s) => !s.churn || s.churn > now);
  const rate = cohort.length ? pct(still.length, cohort.length) : null;

  const churned = spans.filter((s) => s.churn && (!start || s.churn >= start) && s.churn <= now)
    .map((s) => ({ c: s.c, at: s.churn!, reason: (s.c.lost_reason || "No reason given").trim() }));
  const byReason = new Map<string, number>();
  churned.forEach((x) => byReason.set(x.reason, (byReason.get(x.reason) || 0) + 1));
  const SHADES = [100, 72, 52, 36, 24];
  const reasons: Slice[] = [...byReason.entries()].sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: tint("#2a8c8c", SHADES[i % SHADES.length]) }));

  // Month by month: of the clients active on the 1st, how many were still active at the month's end.
  const earliest = spans.length ? Math.min(...spans.map((s) => s.from.getTime())) : now.getTime();
  const sinceEarliest = (now.getFullYear() - new Date(earliest).getFullYear()) * 12 + now.getMonth() - new Date(earliest).getMonth() + 1;
  const n = range === "12m" ? 12 : range === "all" ? Math.min(24, Math.max(1, sinceEarliest)) : 3;
  const monthly = Array.from({ length: n }, (_, k) => {
    const first = new Date(now.getFullYear(), now.getMonth() - (n - 1 - k), 1);
    const end = new Date(Math.min(new Date(first.getFullYear(), first.getMonth() + 1, 1).getTime(), now.getTime()));
    const base = spans.filter((s) => activeOn(s, first));
    const label = MONTHS[first.getMonth()] + (n > 12 ? ` ’${String(first.getFullYear()).slice(2)}` : "");
    const churnedThisMonth = spans.filter((s) => s.churn && s.churn >= first && s.churn < end).length;
    return { label, rate: base.length ? pct(base.filter((s) => !s.churn || s.churn > end).length, base.length) : null, churned: churnedThisMonth };
  });
  const points = monthly.filter((m) => m.rate !== null) as { label: string; rate: number; churned: number }[];
  const low = points.length ? points.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  const startLabel = start ? start.toLocaleDateString("en-US", start.getFullYear() === now.getFullYear()
    ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }) : "";
  const top = reasons[0];
  const takeaway = rate === null ? "" : `${rate}% of ${start ? `clients active on ${startLabel}` : "clients ever active"} are still active (${still.length} of ${cohort.length}). `
    + (!churned.length ? "No one churned in this period."
      : top && top.value > 1 ? `${plural(churned.length, "client")} churned; most common reason: “${top.label}”.`
      : `${plural(churned.length, "client")} churned, each for a different reason.`);
  const lineTakeaway = points.length < 2 || !low ? "" : points.every((p) => p.rate === points[0].rate)
    ? `Steady at ${points[0].rate}% every month.`
    : `Lowest month: ${low.label} at ${low.rate}%. Latest: ${points[points.length - 1].label} at ${points[points.length - 1].rate}%.`;
  const worst = monthly.reduce((a, b) => (b.churned > a.churned ? b : a), monthly[0]);
  const churnTakeaway = !churned.length ? "No churn in this period."
    : `${plural(churned.length, "client")} churned in ${plural(monthly.filter((m) => m.churned).length, "month")}${worst?.churned ? `; the most was ${worst.churned} in ${worst.label}` : ""}.`;
  return { rate, cohort: cohort.length, still: still.length, churned, reasons, monthly, points, takeaway, lineTakeaway, churnTakeaway };
}

/** Health split of current clients, for the small donut on the Retention page. */
export function healthSplit(data: AllData): Slice[] {
  const active = data.contacts.filter((c) => c.stage === "Active / Retention");
  return HEALTH_COLUMNS.map((h) => ({
    label: h.label, color: h.hex, value: active.filter((c) => clientHealth(c, data.interactions, data.tasks).health === h.key).length,
  }));
}

// ---------- Onboarding speed ----------

export function onboardingSpeed(data: AllData, range: RangeKey, now = new Date()) {
  const start = rangeStart(range, now);
  const byId = new Map(data.contacts.map((c) => [c.id, c]));
  const rows = data.onboarding.filter((o) => byId.has(o.contact_id));
  const begun = (o: Row) => at(o[enteredCol(ONBOARDING_STAGES[0].key)] || o.start_date);
  const inRange = rows.filter((o) => !start || (begun(o) && begun(o)! >= start));

  const average = (list: Row[]) => {
    const durs = list.map(stageDurations);
    return ONBOARDING_STAGES.map((s) => {
      const vals = durs.map((d) => d[s.key]).filter((v): v is number => v !== undefined);
      return { key: s.key, label: s.label, avg: vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null, n: vals.length };
    });
  };
  const stages = average(inRange);
  const fv = inRange.map(daysToFirstValue).filter((v): v is number => v !== null);
  const avgToFirstValue = fv.length ? round1(fv.reduce((a, b) => a + b, 0) / fv.length) : null;

  // "Stuck": still onboarding and already longer in their stage than the all-time average for it.
  const allAvg = Object.fromEntries(average(rows).map((s) => [s.key, s.avg]));
  const stuck = rows.filter((o) => byId.get(o.contact_id)?.stage === "Onboarding").map((o) => {
    const stage = currentStage(o);
    return { c: byId.get(o.contact_id)!, stage, days: daysInStage(o, now) ?? 0, avg: allAvg[stage.key] as number | null };
  }).filter((x) => x.avg !== null && x.days > x.avg && x.days - x.avg >= 2).sort((a, b) => (b.days - b.avg!) - (a.days - a.avg!));

  const measured = stages.filter((s) => s.avg !== null);
  const enough = measured.reduce((a, s) => a + s.n, 0) >= 2;
  const slowest = measured.length ? measured.reduce((a, b) => (b.avg! > a.avg! ? b : a)) : null;
  const takeaway = !enough || !slowest ? "" : `Clients spend longest in ${slowest.label} (${slowest.avg} days on average).`
    + (avgToFirstValue !== null ? ` First value takes ${avgToFirstValue} days from handoff.` : "")
    + (stuck.length ? ` ${plural(stuck.length, "client")} slower than average right now.` : " Nobody is slower than average right now.");
  return { stages, avgToFirstValue, stuck, enough, takeaway };
}
