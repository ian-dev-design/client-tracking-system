// The weekly digest: one plain email per teammate with their week at a glance.
// Sent by the daily job (app/api/cron/daily) on each person's chosen day, or now from Settings.

import { loadAll } from "@/lib/crm";
import { store } from "@/lib/data";
import { dashboardData } from "@/lib/dashboard";
import { getSettings, sendTeamEmail, SYSTEM_NAME, DAYS, appUrl } from "@/lib/notify";
import { moneyShort } from "@/lib/target";
import { team, teammateFor, isPerson, type Teammate } from "@/lib/team";
import { addDays, formatDate, isTrue, isUrgent, newId, nowStamp, today } from "@/lib/util";

export type DigestSection = { title: string; items: string[] };
export type Digest = { to: Teammate; subject: string; body: string; sections: DigestSection[]; pipeline: string; empty: boolean };

/** Mon..Sun for a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => DAYS[(new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7];

export async function buildDigest(mate: Teammate, data?: Awaited<ReturnType<typeof loadAll>>): Promise<Digest> {
  const d = data || (await loadAll());
  const now = today();
  const weekAhead = addDays(now, 7);
  const weekAgo = addDays(now, -7);
  const mine = (v: string) => isPerson(v, mate);
  const name = new Map(d.contacts.map((c) => [c.id, c.name]));
  const owned = d.contacts.filter((c) => mine(c.owner));
  const ownedIds = new Set(owned.map((c) => c.id));

  const open = d.tasks.filter((t) => !isTrue(t.done) && mine(t.assigned_to)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const taskLine = (t: Record<string, string>) =>
    `${isUrgent(t) ? "[URGENT] " : ""}${t.title}${t.contact_id ? ` — ${name.get(t.contact_id) || ""}` : ""}${t.due_date ? ` (due ${formatDate(t.due_date)})` : ""}`;
  const overdue = open.filter((t) => t.due_date && t.due_date < now);
  const dueToday = open.filter((t) => t.due_date === now);
  const thisWeek = open.filter((t) => t.due_date > now && t.due_date <= weekAhead);

  const dash = dashboardData(d);
  const attention = dash.needsAttention.filter((a) => ownedIds.has(a.c.id))
    .map((a) => `${a.c.name} — ${a.reasons.map((r) => r.detail).join("; ")}`);
  const surveys = d.surveys.filter((s) => ownedIds.has(s.contact_id) && (s.date_completed || s.created_at.slice(0, 10)) >= weekAgo)
    .map((s) => `${name.get(s.contact_id)} answered the survey (${formatDate(s.date_completed || s.created_at)})`);
  const moves = d.interactions
    .filter((i) => ownedIds.has(i.contact_id) && i.type === "note" && /^(Stage|Research status): /.test(i.summary) && (i.date || i.created_at.slice(0, 10)) >= weekAgo)
    .map((i) => `${name.get(i.contact_id)}: ${i.summary.replace(/^(Stage|Research status): /, "")}`);

  const openDeals = d.contacts.filter((c) => c.deal_status !== "won" && c.deal_status !== "lost" && c.stage !== "Churned / Lost" && Number(String(c.deal_value).replace(/[$,\s]/g, "")) > 0).length;
  const pipeline = `${moneyShort(dash.pipelineTotal)} open across ${openDeals} deal${openDeals === 1 ? "" : "s"} · ${moneyShort(dash.wonTotal)} won`;

  const sections: DigestSection[] = [
    { title: `Overdue tasks (${overdue.length})`, items: overdue.map(taskLine) },
    { title: `Due today (${dueToday.length})`, items: dueToday.map(taskLine) },
    { title: `Due this week (${thisWeek.length})`, items: thisWeek.map(taskLine) },
    { title: `Clients needing attention (${attention.length})`, items: attention },
    { title: `New survey responses (${surveys.length})`, items: surveys },
    { title: `Stage moves this week (${moves.length})`, items: moves },
  ].filter((s) => s.items.length);
  const empty = sections.length === 0;

  const body = [
    `Hi ${mate.name},`, "", "Here's your week in the CRM.", "",
    ...sections.flatMap((s) => [s.title.toUpperCase(), ...s.items.map((i) => `• ${i}`), ""]),
    "PIPELINE", pipeline, "",
    `Open your tasks: ${appUrl()}/tasks`, "",
    "—", `${SYSTEM_NAME} · change the digest day or turn it off at ${appUrl()}/settings/notifications`,
  ].join("\n");
  const count = overdue.length + dueToday.length + thisWeek.length;
  const subject = `Your week: ${count} open task${count === 1 ? "" : "s"}${overdue.length ? `, ${overdue.length} overdue` : ""}`;
  return { to: mate, subject, body, sections, pipeline, empty };
}

export type DigestResult = { name: string; status: string };

/**
 * Send digests. Scheduled run: only people whose digest day is today, once per day each.
 * `now: true` (the Settings button): everyone with the digest turned on, right away.
 * People with nothing to report get no email.
 */
export async function sendDigests(opts: { now?: boolean } = {}): Promise<DigestResult[]> {
  const date = today(), day = weekdayOf(date);
  const [data, log] = await Promise.all([loadAll(), store().list("activity_log")]);
  const results: DigestResult[] = [];
  for (const mate of team()) {
    const s = await getSettings(mate.email);
    if (!s.digest_email) { results.push({ name: mate.name, status: "digest turned off" }); continue; }
    if (!opts.now && s.digest_day !== day) { results.push({ name: mate.name, status: `not their day (${s.digest_day})` }); continue; }
    if (!opts.now && log.some((l) => l.action === "digest_email" && l.details === `${mate.email} · ${date}`)) {
      results.push({ name: mate.name, status: "already sent today" }); continue;
    }
    const dg = await buildDigest(mate, data);
    if (dg.empty) { results.push({ name: mate.name, status: "nothing to report, skipped" }); continue; }
    const res = await sendTeamEmail({ to: mate.email, subject: dg.subject, body: dg.body, refId: `digest:${date}` });
    if (res.sent) {
      await store().insert("activity_log", { id: newId("log"), at: nowStamp(), user: SYSTEM_NAME, action: "digest_email", table: "notifications", record_id: `digest:${date}`, details: `${mate.email} · ${date}` });
    }
    results.push({ name: mate.name, status: res.sent ? "sent" : `not sent (${res.reason})` });
  }
  return results;
}

export { teammateFor };
