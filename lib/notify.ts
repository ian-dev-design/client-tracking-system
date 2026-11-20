// Team notifications: the bell (in-app) and short emails to teammates.
//
// HARD RULE: internal notification emails go ONLY to teammates on ALLOWED_EMAILS, never to a client
// or contact. sendTeamEmail() below is the single function that sends them and enforces this itself.
// Emails to clients and contacts are a different path (POST /api/outreach/send) and always need a
// human clicking "Approve & send".

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { store, type Row } from "@/lib/data";
import { sendGmail } from "@/lib/gmail";
import { currentContext } from "@/lib/requestContext";
import { team, teammateFor, teamEmails, type Teammate } from "@/lib/team";
import { formatDate, isAutoUrgent, isTrue, isUrgent, newId, normEmail, nowStamp, today } from "@/lib/util";

export const SYSTEM_NAME = "Client Tracking System";
export const DAILY_EMAIL_CAP = 20; // per person per day
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type NotifyType = "assign_task" | "assign_client" | "handoff" | "urgent" | "stage_move" | "survey";
// Which setting controls the email for each type (types not listed are in-app only).
const EMAIL_SETTING: Partial<Record<NotifyType, keyof Settings>> = {
  assign_task: "assign_email", assign_client: "assign_email", handoff: "assign_email", urgent: "urgent_email",
};

export const appUrl = () => (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

// ---------- Settings ----------

export type Settings = { assign_email: boolean; urgent_email: boolean; digest_email: boolean; digest_day: string };
const on = (v: string | undefined) => v === undefined || v === "" || isTrue(v); // default: on

export async function getSettings(email: string): Promise<Settings & { id?: string }> {
  const row = (await store().list("notification_settings")).find((r) => normEmail(r.email) === normEmail(email));
  return {
    id: row?.id,
    assign_email: on(row?.assign_email), urgent_email: on(row?.urgent_email), digest_email: on(row?.digest_email),
    digest_day: DAYS.includes(row?.digest_day as (typeof DAYS)[number]) ? row!.digest_day : "Mon",
  };
}

export async function saveSettings(email: string, s: Settings) {
  if (!teamEmails().includes(normEmail(email))) throw new Error("Only teammates have notification settings.");
  const current = await getSettings(email);
  const row: Row = {
    email: normEmail(email), assign_email: s.assign_email ? "TRUE" : "FALSE", urgent_email: s.urgent_email ? "TRUE" : "FALSE",
    digest_email: s.digest_email ? "TRUE" : "FALSE", digest_day: DAYS.includes(s.digest_day as (typeof DAYS)[number]) ? s.digest_day : "Mon",
    updated_at: nowStamp(),
  };
  if (current.id) await store().update("notification_settings", current.id, row);
  else await store().insert("notification_settings", { id: newId("ns"), ...row });
}

// ---------- Who sends ----------

type Sender = { kind: "user" | "system" | "demo"; from: string; accessToken?: string };

/** The designated sender for scheduled jobs: a permission stored only in env vars (never git or the Sheet). */
async function systemSender(): Promise<Sender | null> {
  const from = process.env.NOTIFY_SENDER_EMAIL, refreshToken = process.env.NOTIFY_SENDER_REFRESH_TOKEN;
  if (!from || !refreshToken) return null;
  const { refreshAccessToken } = await import("@/lib/auth");
  try { return { kind: "system", from, accessToken: (await refreshAccessToken(refreshToken)).access_token }; }
  catch { return null; }
}

/** In the app: the signed-in user's own Gmail. In a scheduled job: the designated sender. CLI: none. */
async function resolveSender(): Promise<Sender | null> {
  const ctx = currentContext();
  if (ctx.user?.demo) return { kind: "demo", from: ctx.user.email };
  if (ctx.user && ctx.req) {
    const { gmailAccessToken } = await import("@/lib/auth");
    const token = await getToken({ req: ctx.req as NextRequest, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = await gmailAccessToken(token as Record<string, unknown> | null);
    return accessToken ? { kind: "user", from: ctx.user.email, accessToken } : null;
  }
  if (ctx.system) return systemSender();
  return null;
}

async function log(user: string, action: string, recordId: string, details: string) {
  await store().insert("activity_log", { id: newId("log"), at: nowStamp(), user, action, table: "notifications", record_id: recordId, details });
}

// ---------- The ONE function that emails teammates ----------

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Email a teammate. Refuses anyone not on ALLOWED_EMAILS and anyone who is a contact, whatever the caller
 * passes. While EMAIL_TEST_REDIRECT is set, delivers to that address instead. Caps emails per person per day.
 */
export async function sendTeamEmail(msg: { to: string; subject: string; body: string; refId: string }): Promise<EmailResult> {
  const to = normEmail(msg.to);
  // 1. Teammates only. This check lives here so no caller can skip it.
  if (!teamEmails().includes(to)) {
    await log(SYSTEM_NAME, "notify_email_blocked", msg.refId, `${to} · not on ALLOWED_EMAILS`);
    return { sent: false, reason: "not a teammate" };
  }
  // 2. Never a client or contact, even if their email is also on the team list.
  const contactEmails = new Set((await store().list("contacts")).map((c) => normEmail(c.email)).filter(Boolean));
  if (contactEmails.has(to)) {
    await log(SYSTEM_NAME, "notify_email_blocked", msg.refId, `${to} · is a contact`);
    return { sent: false, reason: "is a contact" };
  }
  // 3. Daily cap per person.
  const day = today();
  const sentToday = (await store().list("activity_log"))
    .filter((l) => l.action === "notify_email" && l.at.startsWith(day) && l.details.startsWith(`${to} ·`)).length;
  if (sentToday >= DAILY_EMAIL_CAP) {
    await log(SYSTEM_NAME, "notify_email_capped", msg.refId, `${to} · ${DAILY_EMAIL_CAP}/day limit reached`);
    return { sent: false, reason: "daily limit" };
  }
  const sender = await resolveSender();
  if (!sender) return { sent: false, reason: "no sender" };

  const redirect = process.env.EMAIL_TEST_REDIRECT?.trim();
  const deliverTo = redirect || to;
  const subject = redirect ? `[TEST → ${to}] ${msg.subject}` : msg.subject;
  if (sender.kind !== "demo") {
    await sendGmail({ accessToken: sender.accessToken!, from: sender.from, to: deliverTo, subject, body: msg.body });
  }
  await log(sender.kind === "system" ? SYSTEM_NAME : sender.from, "notify_email", msg.refId,
    `${to} · ${msg.subject}${redirect ? ` (test mode: delivered to ${deliverTo})` : ""}${sender.kind === "demo" ? " (demo: not actually sent)" : ""}`);
  return { sent: true };
}

// ---------- Notifications ----------

export type NotifyEvent = {
  to: string; // teammate name or email
  type: NotifyType;
  title: string; // one line, shown in the bell
  link: string; // app path, e.g. /contacts/c_123
  by: string; // who did it (a teammate name, or SYSTEM_NAME / "Survey")
  eventKey: string; // same key = same event = no second notification or email
  email?: { subject: string; lines: string[] };
};

/** Bell + (if their settings allow) email. Never fails the action that triggered it. */
export async function notify(e: NotifyEvent, opts: { emailIfPending?: boolean } = {}) {
  try {
    const mate = teammateFor(e.to, team());
    if (!mate) return; // only teammates get notifications
    if (teammateFor(e.by, [mate])) return; // never about your own action on yourself
    const all = await store().list("notifications");
    let row = all.find((n) => n.event_key === e.eventKey && normEmail(n.to) === mate.email);
    if (row && !(opts.emailIfPending && !row.emailed_at)) return; // already done
    if (!row) {
      row = { id: newId("n"), to: mate.email, type: e.type, title: e.title, link: e.link, by: e.by, event_key: e.eventKey, read: "", emailed_at: "", created_at: nowStamp() };
      await store().insert("notifications", row);
      await log(e.by, "notify", row.id, `${mate.name} · ${e.title}`);
    }
    const setting = EMAIL_SETTING[e.type];
    if (!setting || !e.email || !(await getSettings(mate.email))[setting]) return;
    const res = await sendTeamEmail({ to: mate.email, subject: e.email.subject, body: emailBody(mate, e.email.lines, e.link), refId: row.id });
    if (res.sent) await store().update("notifications", row.id, { emailed_at: nowStamp() });
  } catch (err) {
    console.error("notify failed:", err);
  }
}

/** Short, plain email: the lines, a link, and where to change settings. */
export function emailBody(mate: Teammate, lines: string[], link: string) {
  return [`Hi ${mate.name},`, "", ...lines, "", `Open it: ${appUrl()}${link}`, "",
    "—", `${SYSTEM_NAME} · change these emails at ${appUrl()}/settings/notifications`].join("\n");
}

// ---------- Helpers for the triggers ----------

export { isAutoUrgent, isUrgent } from "@/lib/util";

export function taskEmailLines(t: Row, clientName: string, by: string, what: string) {
  return [
    `${by} ${what}: ${t.title}`,
    clientName && `Client: ${clientName}`,
    `Due: ${t.due_date ? formatDate(t.due_date) : "no due date"}`,
    isUrgent(t) && `Priority: Urgent${t.priority !== "Urgent" ? " (overdue 3+ days)" : ""}`,
    t.notes && `Note: ${t.notes}`,
  ].filter(Boolean) as string[];
}

/**
 * Tasks that just became urgent by being 3+ days overdue → notify their assignee once.
 * In the app (bell) it creates the notification; the daily job also emails any not yet emailed.
 */
export async function checkAutoUrgent(onlyFor?: string) {
  const [tasks, contacts] = await Promise.all([store().list("tasks"), store().list("contacts")]);
  const names = new Map(contacts.map((c) => [c.id, c.name]));
  const mates = team();
  for (const t of tasks.filter((x) => isAutoUrgent(x) && x.priority !== "Urgent")) {
    const mate = teammateFor(t.assigned_to, mates);
    if (!mate || (onlyFor && mate.email !== normEmail(onlyFor))) continue;
    await notify({
      to: mate.email, type: "urgent", by: SYSTEM_NAME, link: "/tasks", eventKey: `autourgent:${t.id}:${t.due_date}`,
      title: `Now urgent (3+ days overdue): ${t.title}`,
      email: { subject: `Urgent: ${t.title}`, lines: taskEmailLines(t, names.get(t.contact_id) || "", "This task", "is now 3+ days overdue") },
    }, { emailIfPending: !onlyFor });
  }
}

/** Notifications for one person, newest first. */
export async function notificationsFor(email: string, limit = 30) {
  return (await store().list("notifications"))
    .filter((n) => normEmail(n.to) === normEmail(email))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function markRead(email: string, id?: string) {
  const mine = (await store().list("notifications")).filter((n) => normEmail(n.to) === normEmail(email) && !isTrue(n.read));
  for (const n of mine.filter((x) => !id || x.id === id)) await store().update("notifications", n.id, { read: "TRUE" });
}

/** What an assignment / urgent email looks like for `mate`, built from a real open task. For the preview page. */
export async function sampleEmail(kind: "assign" | "urgent", mate: Teammate, by: string) {
  const [tasks, contacts] = await Promise.all([store().list("tasks"), store().list("contacts")]);
  const open = tasks.filter((t) => !isTrue(t.done));
  const t = open.find((x) => teammateFor(x.assigned_to, [mate])) || open[0]
    || { id: "sample", title: "Send the site visit quote", due_date: today(), contact_id: "", notes: "", priority: "", done: "" };
  const client = contacts.find((c) => c.id === t.contact_id)?.name || "";
  const lines = kind === "assign"
    ? taskEmailLines(t, client, by, "assigned you a task")
    : taskEmailLines({ ...t, priority: "Urgent" }, client, by, "marked this task urgent");
  return { subject: `${kind === "assign" ? "New task: " : "Urgent: "}${t.title}`, body: emailBody(mate, lines, "/tasks") };
}
