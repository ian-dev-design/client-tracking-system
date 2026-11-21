// Numbers for the Team page: who has what (people list), how efficiently tasks get done, and recent activity.
// All computed from the data; takeaways are plain sentences, no AI.

import type { AllData } from "@/lib/crm";
import { stageByKey } from "@/lib/onboarding";
import { teammateFor, type Teammate } from "@/lib/team";
import { isTrue, parseStamp, today } from "@/lib/util";

type Row = Record<string, string>;
export type Person = { key: string; label: string; onTeam: boolean };

/** Which person a stored assigned_to / owner value belongs to: the teammate's name, or the raw value if not on the list. */
export const personKey = (value: string, mates: Teammate[]) => (value ? teammateFor(value, mates)?.name || value.trim() : "");

/** Everyone on the team, then anyone else work is assigned to (so nothing is hidden), then Unassigned. */
export function teamPeople(names: string[], me: string, values: string[]): Person[] {
  const extra = [...new Set(values)].filter((w) => w && !names.includes(w)).sort();
  return [
    ...names.map((n) => ({ key: n, label: n === me ? `${n} (you)` : n, onTeam: true })),
    ...extra.map((n) => ({ key: n, label: n, onTeam: false })),
    { key: "", label: "Unassigned", onTeam: false },
  ];
}

/** When a task was finished (completed_at, or done_at for older rows). */
export const completedAt = (t: Row) => t.completed_at || t.done_at || "";

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export type EfficiencyRow = {
  key: string; label: string; completed: number; onTime: number; late: number; onTimePct: number | null;
  avgDays: number | null; overdueNow: number; takeaway: string;
};

/**
 * Per person over the last `days` days:
 *   completed      tasks finished in the period
 *   on-time rate   finished on or before the due date ÷ all finished (no due date counts as on time)
 *   avg days       from created to finished
 *   overdue now    open tasks past their due date
 */
export function efficiency(tasks: Row[], people: Person[], mates: Teammate[], days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const t0 = today();
  const rows: EfficiencyRow[] = people.filter((p) => p.key).map((p) => {
    const mine = tasks.filter((t) => personKey(t.assigned_to, mates) === p.key);
    const done = mine.filter((t) => isTrue(t.done) && completedAt(t) && parseStamp(completedAt(t)) >= since);
    const late = done.filter((t) => t.due_date && completedAt(t).slice(0, 10) > t.due_date).length;
    const spans = done.filter((t) => t.created_at).map((t) => (parseStamp(completedAt(t)).getTime() - parseStamp(t.created_at).getTime()) / DAY).filter((d) => d >= 0);
    const overdueNow = mine.filter((t) => !isTrue(t.done) && t.due_date && t.due_date < t0).length;
    const onTimePct = done.length ? Math.round(((done.length - late) / done.length) * 100) : null;
    const avgDays = spans.length ? round1(spans.reduce((a, b) => a + b, 0) / spans.length) : null;
    const takeaway = !done.length
      ? (overdueNow ? `Nothing finished in ${days} days and ${plural(overdueNow, "task")} overdue.` : `Nothing finished in the last ${days} days.`)
      : `${plural(done.length, "task")} done, ${onTimePct}% on time${avgDays !== null ? `, ${avgDays} days on average` : ""}.`
        + (overdueNow ? ` ${plural(overdueNow, "task")} overdue now.` : " Nothing overdue.");
    return { key: p.key, label: p.label, completed: done.length, onTime: done.length - late, late, onTimePct, avgDays, overdueNow, takeaway };
  });
  const total = rows.reduce((a, r) => a + r.completed, 0);
  const rated = rows.filter((r) => r.completed >= 2);
  const best = rated.length ? rated.reduce((a, b) => ((b.onTimePct ?? 0) > (a.onTimePct ?? 0) ? b : a)) : null;
  const most = rows.length ? rows.reduce((a, b) => (b.completed > a.completed ? b : a)) : null;
  const teamOnTime = total ? Math.round((rows.reduce((a, r) => a + r.onTime, 0) / total) * 100) : null;
  const takeaway = !total ? `No tasks were finished in the last ${days} days.`
    : `The team finished ${plural(total, "task")} in ${days} days, ${teamOnTime}% on time.`
      + (most && most.completed ? ` ${most.label.replace(" (you)", "")} finished the most (${most.completed}).` : "")
      + (best && best !== most ? ` ${best.label.replace(" (you)", "")} was the most on time (${best.onTimePct}%).` : "");
  return { rows, takeaway, total };
}

// ---------- Activity ----------

export type ActivityKind = "done" | "assign" | "reassign" | "stage" | "outreach" | "interview";
export type ActivityItem = { id: string; at: string; who: string; kind: ActivityKind; text: string; client: string; clientId: string };

/**
 * Recent activity, newest first: tasks completed, tasks assigned / reassigned / handed off, clients moved
 * between stages (pipeline and onboarding), and outreach and interviews logged.
 */
export function activityFeed(data: AllData, mates: Teammate[], limit = 80): ActivityItem[] {
  const contacts = new Map(data.contacts.map((c) => [c.id, c]));
  const tasks = new Map(data.tasks.map((t) => [t.id, t]));
  const who = (v: string) => personKey((v || "").replace(/ \(Claude Code\)$/, ""), mates) || v || "Someone";
  const items: ActivityItem[] = [];

  for (const t of data.tasks.filter((x) => isTrue(x.done) && completedAt(x))) {
    const c = contacts.get(t.contact_id);
    items.push({ id: `done:${t.id}`, at: completedAt(t), who: who(t.assigned_to), kind: "done", text: `completed “${t.title}”`, client: c?.name || "", clientId: c?.id || "" });
  }
  for (const l of data.activityLog || []) {
    const isTask = l.table === "tasks";
    const assign = isTask && l.action === "create";
    if (!assign && !["reassign", "handoff"].includes(l.action)) continue;
    const t = isTask ? tasks.get(l.record_id) : undefined;
    const c = contacts.get(isTask ? t?.contact_id || "" : l.record_id);
    // details read like "Ian added task “x” for Jamie": drop the leading actor name, it's shown separately.
    const text = (l.details || l.action).replace(new RegExp(`^${l.user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`), "");
    items.push({ id: `log:${l.id}`, at: l.at, who: who(l.user), kind: assign ? "assign" : "reassign", text, client: c?.name || "", clientId: c?.id || "" });
  }
  for (const h of data.stageHistory.filter((x) => x.from_stage && x.track !== "research")) {
    const c = contacts.get(h.contact_id);
    const name = (k: string) => (h.track === "onboarding" ? stageByKey(k)?.label || k : k);
    items.push({ id: `sh:${h.id}`, at: h.at, who: who(h.by), kind: "stage", text: `moved ${c?.name || "a client"} from ${name(h.from_stage)} to ${name(h.to_stage)}`, client: c?.name || "", clientId: c?.id || "" });
  }
  for (const i of data.interactions.filter((x) => ["email", "text", "interview", "meeting"].includes(x.type))) {
    const c = contacts.get(i.contact_id);
    const interview = i.type === "interview" || i.type === "meeting";
    items.push({ id: `int:${i.id}`, at: i.created_at || `${i.date} 09:00`, who: who(i.logged_by), kind: interview ? "interview" : "outreach",
      text: interview ? `logged ${i.type === "meeting" ? "a meeting" : "an interview"} with ${c?.name || "a contact"}` : `sent outreach to ${c?.name || "a contact"}`,
      client: c?.name || "", clientId: c?.id || "" });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
