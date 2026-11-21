// Retention as a process: each active client's health (calculated, or set by hand) and where their renewal stands.
// Pure helpers over loaded data, shared by the Retention page, the Insights page and the profile.

import { amount } from "@/lib/target";
import { daysSince, isTrue, today } from "@/lib/util";

type Row = Record<string, string>;

export type Health = "green" | "yellow" | "red";
export const HEALTH_COLUMNS: { key: Health; label: string; dot: string; hex: string }[] = [
  { key: "green", label: "Healthy", dot: "bg-success", hex: "#2f6b4f" },
  { key: "yellow", label: "Needs attention", dot: "bg-amber", hex: "#d69a2d" },
  { key: "red", label: "At risk", dot: "bg-coral", hex: "#b84a2c" },
];
export const healthLabel = (h: string) => HEALTH_COLUMNS.find((x) => x.key === h)?.label || "Healthy";

// Interactions that are real contact with the client (stage-change notes and internal notes don't count).
const CONTACT_TYPES = new Set(["email", "text", "call", "meeting", "interview", "survey"]);

/** Date of the last real contact with this client ("" if never). */
export function lastContact(contactId: string, interactions: Row[]): string {
  return interactions.filter((i) => i.contact_id === contactId && CONTACT_TYPES.has(i.type)).map((i) => i.date).sort().pop() || "";
}

/** Open tasks for this client that are past due. */
export const overdueTasks = (contactId: string, tasks: Row[]) =>
  tasks.filter((t) => t.contact_id === contactId && !isTrue(t.done) && t.due_date && t.due_date < today());

/** Open issues: open tasks for this client marked Urgent. */
export const openIssues = (contactId: string, tasks: Row[]) =>
  tasks.filter((t) => t.contact_id === contactId && !isTrue(t.done) && t.priority === "Urgent");

/**
 * Calculated health score, from four signals:
 *   days since last contact, overdue tasks, open issues (urgent tasks) and how close the renewal is.
 *   At risk          45+ days quiet (or never contacted), 2+ overdue tasks, or the renewal date has passed
 *   Needs attention  30–44 days quiet, 1 overdue task, an open issue, or renewal within 30 days with 14+ days quiet
 *   Healthy          everything else
 * `reason` is the first signal that decided it, in plain words.
 */
export function autoHealth(c: Row, interactions: Row[], tasks: Row[]): { health: Health; daysQuiet: number | null; reason: string } {
  const daysQuiet = daysSince(lastContact(c.id, interactions));
  const overdue = overdueTasks(c.id, tasks).length;
  const issues = openIssues(c.id, tasks).length;
  const sinceRenewed = daysSince((c.last_renewed_at || "").slice(0, 10));
  const toRenewal = sinceRenewed !== null && sinceRenewed <= RENEWED_DAYS ? null : daysToRenewal(c);
  const red: string[] = [], yellow: string[] = [];
  if (daysQuiet === null) red.push("Never contacted");
  else if (daysQuiet >= 45) red.push(`Quiet ${daysQuiet} days`);
  else if (daysQuiet >= 30) yellow.push(`Quiet ${daysQuiet} days`);
  if (overdue >= 2) red.push(`${overdue} overdue tasks`); else if (overdue) yellow.push("1 overdue task");
  if (toRenewal !== null && toRenewal < 0) red.push(`Renewal ${-toRenewal} days overdue`);
  if (issues) yellow.push(`${issues} open issue${issues === 1 ? "" : "s"}`);
  if (toRenewal !== null && toRenewal >= 0 && toRenewal <= 30 && (daysQuiet ?? 99) >= 14) yellow.push(`Renewal in ${toRenewal} days, quiet ${daysQuiet} days`);
  if (red.length) return { health: "red", daysQuiet, reason: red[0] };
  if (yellow.length) return { health: "yellow", daysQuiet, reason: yellow[0] };
  return { health: "green", daysQuiet, reason: "In touch, nothing overdue" };
}

const isHealth = (v: string): v is Health => v === "green" || v === "yellow" || v === "red";

/** Health shown on the board: a manual override (with its reason) wins over the calculation. */
export function clientHealth(c: Row, interactions: Row[], tasks: Row[]) {
  const auto = autoHealth(c, interactions, tasks);
  const manual = isHealth(c.health_override) ? c.health_override : null;
  return { ...auto, health: manual || auto.health, auto: auto.health, autoReason: auto.reason, manual: !!manual,
    reason: manual ? (c.health_reason || "Set by hand") : auto.reason };
}

// ---------- Renewals ----------

export type RenewalBucket = "90" | "60" | "30" | "overdue" | "renewed" | "churned";
// Left to right as the date gets closer; Renewed and Churned at the end.
export const RENEWAL_COLUMNS: { key: RenewalBucket; label: string }[] = [
  { key: "90", label: "90+ days" },
  { key: "60", label: "60 days" },
  { key: "30", label: "30 days" },
  { key: "overdue", label: "Overdue" },
  { key: "renewed", label: "Renewed" },
  { key: "churned", label: "Churned" },
];
/** A renewal stays in the Renewed column this many days, then moves back into the time buckets by its next date. */
export const RENEWED_DAYS = 60;

/** Days until the renewal date (negative = past due), or null if no date. */
export const daysToRenewal = (c: Row) => { const d = daysSince(c.renewal_date); return d === null ? null : -d; };

export function renewalBucket(c: Row): RenewalBucket {
  if (c.stage === "Churned / Lost") return "churned";
  const sinceRenewed = daysSince((c.last_renewed_at || "").slice(0, 10));
  if (sinceRenewed !== null && sinceRenewed <= RENEWED_DAYS) return "renewed";
  const until = daysToRenewal(c);
  if (until === null) return "90";
  return until < 0 ? "overdue" : until <= 30 ? "30" : until <= 60 ? "60" : "90";
}

/** Days since the last renewal is within the Renewed window. */
export const renewedRecently = (c: Row) => { const d = daysSince((c.last_renewed_at || "").slice(0, 10)); return d !== null && d <= RENEWED_DAYS; };

/** The next step on a renewal card: the soonest open task, else what the renewal timing calls for. */
export function nextStep(c: Row, tasks: Row[]): string {
  const t = tasks.filter((x) => x.contact_id === c.id && !isTrue(x.done)).sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))[0];
  if (t) return t.title;
  const b = renewalBucket(c);
  if (!c.renewal_date && b !== "churned") return "Set a renewal date";
  return { overdue: "Confirm the renewal", "30": "Start the renewal conversation", "60": "Plan the renewal check-in", "90": "Keep in touch", renewed: "Thank them; plan next season", churned: "" }[b];
}

/** What the renewal is worth: renewal_value, or the deal value when blank. */
export const renewalValue = (c: Row) => amount(c.renewal_value || c.deal_value);

/** A date inside a renewal time bucket, used to prefill "Set renewal date" after a drag. */
export const bucketDefaultDays: Record<string, number> = { "30": 21, "60": 45, "90": 100, renewed: 365 };
