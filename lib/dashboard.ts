// Everything the dashboard shows, computed from the loaded data.
// Kept out of the page so the page is just layout.

import type { AllData } from "@/lib/crm";
import { isProspect, isResearch } from "@/lib/crm";
import type { Row } from "@/lib/data";
import { JOURNEY, journeyOfContact, type JourneyKey } from "@/lib/journey";
import { amount } from "@/lib/target";
import { daysSince, isTrue, splitList, timeAgo, today } from "@/lib/util";
import { isOverdue, isDueToday, lastTouch, readyForInterview } from "@/lib/views";
import type { Slice } from "@/components/charts";

const HEALTH = [{ key: "green" }, { key: "yellow" }, { key: "red" }];

/** What kind of work a reason needs; decides what the "Work on this" page shows. */
export type WorkKind = "followup" | "task" | "interview" | "onboarding" | "quiet";
export type Reason = {
  label: string; // two words
  short: string; // one short line for the dashboard row, e.g. "Follow-up overdue · 2 days"
  detail: string; // the full reason
  tone: "critical" | "alert" | "ready" | "due";
  kind: WorkKind;
  taskId?: string;
};
export type Attention = { c: Row; stage: JourneyKey | null; reasons: Reason[] };

/** One sentence per interaction for the activity feed, e.g. "Ian sent outreach to Jordan Reyes". */
function describe(i: Row, name: string): string {
  const who = i.logged_by || "Someone";
  if (i.type === "email" || i.type === "text") return `${who} sent outreach to ${name}`;
  if (i.type === "survey") return `${name} completed the survey`;
  if (i.type === "interview") return `${who} interviewed ${name}`;
  if (i.type === "call") return `${who} called ${name}`;
  if (i.type === "meeting") return `${who} met with ${name}`;
  const move = i.summary.match(/^(?:Stage|Research status): .* → (.+?)(?: \(.*\))?$/);
  if (move) return `${who} moved ${name} to ${move[1]}`;
  return `${who} added a note on ${name}`;
}

export function dashboardData(data: AllData) {
  const { contacts, interactions, surveys, interviews, themes, onboarding, tasks } = data;
  const byId = new Map(contacts.map((c) => [c.id, c]));

  // Journey split donut + journey row (up to 3 names each)
  // Each person counts once, in the stage they're furthest along (see journeyOfContact).
  const journeyPeople = Object.fromEntries(JOURNEY.map((j) => [j.key, contacts.filter((c) => journeyOfContact(c) === j.key)])) as Record<JourneyKey, Row[]>;
  const journeySplit: Slice[] = JOURNEY.map((j) => ({ label: j.label, value: journeyPeople[j.key].length, color: j.hex, href: j.href }));

  // Survey response donut: of everyone contacted, who completed the survey
  const reached = contacts.filter((c) =>
    (isProspect(c) && c.stage && c.stage !== "Lead") || (isResearch(c) && c.research_status && c.research_status !== "To Contact"));
  const responded = new Set(surveys.filter((s) => s.date_completed).map((s) => s.contact_id));
  const respondedCount = reached.filter((c) => responded.has(c.id)).length;

  // Pipeline value: open deals by stage, plus what's been won.
  // Deals live in Outreach, so the bar uses tints of the Outreach green, light → deep as deals progress.
  const SHADES = [25, 42, 60, 80, 100].map((p) => `color-mix(in srgb, #2f6b4f ${p}%, #ffffff)`);
  const openDeals = contacts.filter((c) => isProspect(c) && c.deal_status !== "won" && c.deal_status !== "lost");
  const pipeline: Slice[] = ["Lead", "Outreach", "Survey Completed", "Client Interview", "Qualified"].map((stage, i) => ({
    label: stage, color: SHADES[i], href: `/contacts?stage=${encodeURIComponent(stage)}`,
    value: openDeals.filter((c) => c.stage === stage).reduce((s, c) => s + amount(c.deal_value), 0),
  }));
  const pipelineTotal = pipeline.reduce((s, x) => s + x.value, 0);
  const wonTotal = contacts.filter((c) => c.deal_status === "won").reduce((s, c) => s + amount(c.deal_value), 0);

  // Onboarding health donut
  const onboardingRows = onboarding.filter((o) => byId.get(o.contact_id)?.stage === "Onboarding");
  const health = Object.fromEntries(HEALTH.map((h) => [h.key, onboardingRows.filter((o) => (o.health || "green") === h.key).length])) as Record<string, number>;

  // Needs attention: one card per person, listing every reason
  const attention = new Map<string, Attention>();
  const flag = (c: Row | undefined, r: Reason) => {
    if (!c) return;
    const a = attention.get(c.id) || { c, stage: journeyOfContact(c), reasons: [] };
    a.reasons.push(r);
    attention.set(c.id, a);
  };
  const days = (n: number | null) => `${n} day${n === 1 ? "" : "s"}`;
  contacts.filter(isOverdue).forEach((c) => {
    const d = daysSince(c.next_followup_date);
    flag(c, { label: "Follow up", short: `Follow-up overdue · ${days(d)}`, detail: `Follow-up overdue by ${days(d)}`,
      tone: (d ?? 0) >= 7 ? "critical" : "alert", kind: "followup" });
  });
  contacts.filter(isDueToday).forEach((c) => flag(c, { label: "Follow up", short: "Follow-up due today", detail: "Follow-up due today", tone: "due", kind: "followup" }));
  contacts.filter((c) => readyForInterview(c, interviews)).forEach((c) =>
    flag(c, { label: "Book interview", short: "Ready for interview", detail: "Ready for interview", tone: "ready", kind: "interview" }));
  tasks.filter((t) => !isTrue(t.done) && t.due_date && t.due_date <= today()).forEach((t) => {
    const d = daysSince(t.due_date) ?? 0;
    flag(byId.get(t.contact_id), d > 0
      ? { label: "Overdue task", short: `Task overdue · ${days(d)}`, detail: `Task overdue: ${t.title}`, tone: d >= 7 ? "critical" : "alert", kind: "task", taskId: t.id }
      : { label: "Task due", short: "Task due today", detail: `Task due today: ${t.title}`, tone: "due", kind: "task", taskId: t.id });
  });
  onboardingRows.filter((o) => o.blockers).forEach((o) =>
    flag(byId.get(o.contact_id), { label: "Unblock setup", short: "Onboarding blocked", detail: `Blocked: ${o.blockers}`, tone: "due", kind: "onboarding" }));
  contacts.filter((c) => c.stage === "Active / Retention").forEach((c) => {
    const d = daysSince(lastTouch(c.id, interactions));
    if (d === null || d >= 30) flag(c, { label: "Check in", short: d === null ? "Never contacted" : `Quiet · ${days(d)}`,
      detail: d === null ? "Never contacted" : `Quiet for ${days(d)}`, tone: "due", kind: "quiet" });
  });
  // Most urgent first: a week+ overdue (critical) → overdue (alert) → due → ready.
  const rank = { critical: 0, alert: 1, due: 2, ready: 3 } as const;
  attention.forEach((a) => a.reasons.sort((x, y) => rank[x.tone] - rank[y.tone]));
  const needsAttention = [...attention.values()].sort((a, b) => rank[a.reasons[0].tone] - rank[b.reasons[0].tone]);

  // Top research themes, each with one short quote
  const topThemes = [...themes]
    .sort((a, b) => Number(b.interview_count) - Number(a.interview_count))
    .slice(0, 3)
    .map((t) => ({ theme: t.theme, count: Number(t.interview_count) || 0, quote: splitList(t.example_quotes, "line")[0] || "" }));

  // Recent activity feed
  const recent = [...interactions]
    .sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date))
    .slice(0, 7)
    .map((i) => {
      const c = byId.get(i.contact_id);
      return { id: i.id, contactId: i.contact_id, stage: c ? journeyOfContact(c) : null, text: describe(i, c?.name || "someone"), when: timeAgo(i.created_at || i.date) };
    });

  return {
    journeySplit, journeyPeople, total: journeySplit.reduce((s, x) => s + x.value, 0),
    respondedCount, reachedCount: reached.length, health, onboardingCount: onboardingRows.length,
    needsAttention, topThemes, recent, pipeline, pipelineTotal, wonTotal,
  };
}
