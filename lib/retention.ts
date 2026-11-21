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

/**
 * Calculated health:
 *   Healthy          contact within 30 days and nothing overdue
 *   Needs attention  30–45 days quiet, or an overdue task
 *   At risk          45+ days quiet (or never contacted)
 */
export function autoHealth(c: Row, interactions: Row[], tasks: Row[]): { health: Health; daysQuiet: number | null; reason: string } {
  const daysQuiet = daysSince(lastContact(c.id, interactions));
  const overdue = overdueTasks(c.id, tasks).length;
  if (daysQuiet === null) return { health: "red", daysQuiet, reason: "Never contacted" };
  if (daysQuiet >= 45) return { health: "red", daysQuiet, reason: `Quiet ${daysQuiet} days` };
  if (daysQuiet >= 30) return { health: "yellow", daysQuiet, reason: `Quiet ${daysQuiet} days` };
  if (overdue) return { health: "yellow", daysQuiet, reason: `${overdue} overdue task${overdue === 1 ? "" : "s"}` };
  return { health: "green", daysQuiet, reason: "In touch, nothing overdue" };
}

const isHealth = (v: string): v is Health => v === "green" || v === "yellow" || v === "red";

/** Health shown on the board: a manual override wins over the calculation. */
export function clientHealth(c: Row, interactions: Row[], tasks: Row[]) {
  const auto = autoHealth(c, interactions, tasks);
  const manual = isHealth(c.health_override) ? c.health_override : null;
  return { ...auto, health: manual || auto.health, auto: auto.health, manual: !!manual };
}

// ---------- Renewals ----------

export type RenewalBucket = "30" | "60" | "90" | "renewed" | "churned";
export const RENEWAL_COLUMNS: { key: RenewalBucket; label: string }[] = [
  { key: "30", label: "Next 30 days" },
  { key: "60", label: "31–60 days" },
  { key: "90", label: "61–90+ days" },
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
  return until <= 30 ? "30" : until <= 60 ? "60" : "90";
}

/** What the renewal is worth: renewal_value, or the deal value when blank. */
export const renewalValue = (c: Row) => amount(c.renewal_value || c.deal_value);

/** A date inside a renewal time bucket, used to prefill "Set renewal date" after a drag. */
export const bucketDefaultDays: Record<string, number> = { "30": 21, "60": 45, "90": 80, renewed: 365 };
