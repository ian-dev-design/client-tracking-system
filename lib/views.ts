// Small read-only helpers the pages use to compute what to show.

import type { Row } from "@/lib/data";
import { isClosed, isProspect, isResearch, onboardingProgress } from "@/lib/crm";
import { ONBOARDING_STEPS } from "@/lib/data";
import { daysSince, isTrue, today } from "@/lib/util";
import { isPerson, team } from "@/lib/team";

export function lastTouch(contactId: string, interactions: Row[]): string {
  return interactions.filter((i) => i.contact_id === contactId).map((i) => i.date).sort().pop() || "";
}

export const isOverdue = (c: Row) => !isClosed(c) && !!c.next_followup_date && c.next_followup_date < today();
export const isDueToday = (c: Row) => !isClosed(c) && c.next_followup_date === today();

/** Took the survey, hasn't been interviewed, and isn't already at an interview stage or later on either track. */
export function readyForInterview(c: Row, interviews: Row[]): boolean {
  const pastSurvey = (isProspect(c) && !!c.stage && !["Lead", "Outreach", "Survey Completed"].includes(c.stage))
    || (isResearch(c) && ["Interview Scheduled", "Interviewed", "Done"].includes(c.research_status));
  const surveyed = (isProspect(c) && c.stage === "Survey Completed") || (isResearch(c) && c.research_status === "Survey Completed");
  return surveyed && !pastSurvey && !interviews.some((iv) => iv.contact_id === c.id);
}

export type Filters = { q?: string; stage?: string; type?: string; owner?: string };

export function filterContacts(contacts: Row[], f: Filters): Row[] {
  const q = (f.q || "").toLowerCase().trim();
  return contacts.filter((c) => {
    if (f.stage && c.stage !== f.stage && c.research_status !== f.stage) return false;
    if (f.type && c.contact_type !== f.type) return false;
    if (f.owner && c.owner !== f.owner) return false;
    if (q && ![c.name, c.company, c.email, c.role, c.notes].some((v) => (v || "").toLowerCase().includes(q))) return false;
    return true;
  });
}

export const owners = (contacts: Row[]) => [...new Set(contacts.map((c) => c.owner).filter(Boolean))].sort();

export const byId = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]));

export function daysLabel(dateStr: string): string {
  const n = daysSince(dateStr);
  if (n === null) return "never";
  if (n === 0) return "today";
  if (n < 0) return `in ${-n}d`;
  return `${n}d ago`;
}

/** Search params come in as string | string[]; normalize to strings. */
export function params(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v || "";
  return out;
}

/** The fields a board card shows, for one contact. */
export function boardCard(c: Row, interactions: Row[], interviews: Row[], drafts: Row[], field: "stage" | "research_status") {
  const touch = lastTouch(c.id, interactions);
  return {
    id: c.id, name: c.name, company: c.company, owner: c.owner, stage: c.stage,
    research_status: c.research_status, contact_type: c.contact_type, fit: Number(c.fit_score) || 0,
    value: Number(String(c.deal_value || "").replace(/[$,\s]/g, "")) || 0,
    lastTouch: touch ? `touched ${daysLabel(touch)}` : "never touched",
    // Only flag "ready for interview" while the card sits in this board's Survey Completed column.
    overdue: isOverdue(c), ready: c[field] === "Survey Completed" && readyForInterview(c, interviews),
    hasDraft: drafts.some((d) => d.contact_id === c.id && d.status === "pending"),
  };
}

/** Teammate names work can be assigned to (everyone on ALLOWED_EMAILS; you, if the list is empty). */
export function people(me: string): string[] {
  const names = team().map((t) => t.name);
  return names.length ? names : [me].filter(Boolean);
}

/** Every contact, for the client picker in the task form. */
export const clientOptions = (contacts: Row[]) =>
  contacts.map((c) => ({ id: c.id, name: c.name, company: c.company || "" })).sort((a, b) => a.name.localeCompare(b.name));

/** Is this task / client yours? Matches your team name or email. */
export const isMine = (value: string, user: { name: string; email: string }) => isPerson(value, user);

/** Open tasks first (soonest due first, undated last), then done ones (most recent first). */
export function sortTasks(tasks: Row[]): Row[] {
  const open = tasks.filter((t) => !isTrue(t.done)).sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const done = tasks.filter((t) => isTrue(t.done)).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  return [...open, ...done];
}

/** Open tasks assigned to you that are due today or earlier. */
export const tasksDue = (tasks: Row[], user: { name: string; email: string }) =>
  tasks.filter((t) => !isTrue(t.done) && isMine(t.assigned_to, user) && t.due_date && t.due_date <= today());

export type NextAction = "draft" | "interview" | "log" | "checklist" | "checkin";
/** The one next step that fits where someone is (used by follow-up and Needs attention rows). */
export function actionFor(c: Row, ready: boolean): NextAction {
  if (ready) return "interview";
  if (c.stage === "Onboarding") return "checklist";
  if (c.stage === "Active / Retention") return "checkin";
  if (["Client Interview", "Qualified"].includes(c.stage) || (!isProspect(c) && ["Interview Scheduled", "Interviewed"].includes(c.research_status))) return "log";
  return "draft";
}

/** What an onboarding card needs, from an onboarding row and its contact. */
export function onboardingView(o: Row, c: Row | undefined) {
  return {
    id: o.id, contactId: o.contact_id, name: c?.name || "Unknown", company: c?.company || "",
    owner: c?.owner || "", health: o.health || "green", blockers: o.blockers || "",
    daysSinceStart: daysSince(o.start_date), progress: onboardingProgress(o),
    steps: ONBOARDING_STEPS.map((s) => ({ key: s.key, label: s.label, done: isTrue(o[s.key]), date: o[`${s.key}_date`] || "" })),
    stage: c?.stage,
  };
}
