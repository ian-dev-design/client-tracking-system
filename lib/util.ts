// Small helpers shared by the app and the CLI.

import raw from "@/config.json";

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

// Timestamps are stored as "YYYY-MM-DD HH:MM" (24-hour) in the team's time zone, so they read clearly
// in the Sheet and still sort correctly as text. Set "timeZone" in config.json.
const TIME_ZONE = (raw as { timeZone?: string }).timeZone || "America/Los_Angeles";

function zoneParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute };
}

/** A Date as "YYYY-MM-DD HH:MM" in the team's time zone. */
export function stamp(d: Date): string {
  const p = zoneParts(d);
  return `${p.y}-${p.m}-${p.d} ${p.h}:${p.mi}`;
}
export const nowStamp = () => stamp(new Date());

const STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

/** Reads a stored timestamp: "YYYY-MM-DD HH:MM" (team time zone) or an older ISO string. */
export function parseStamp(s: string): Date {
  const m = STAMP.exec((s || "").trim());
  if (!m) return new Date(s);
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const p = zoneParts(new Date(asUtc));
  const offset = Date.UTC(+p.y, +p.m - 1, +p.d, +p.h, +p.mi) - asUtc; // the zone's UTC offset at that moment
  return new Date(asUtc - offset);
}

/** Today's date as YYYY-MM-DD in the team's time zone. */
export function today(): string {
  return nowStamp().slice(0, 10);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Whole days from dateStr until today (positive = in the past). */
export function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = dateStr.length <= 10 || STAMP.test(dateStr) ? new Date(dateStr.slice(0, 10) + "T12:00:00") : new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const t = new Date(today() + "T12:00:00");
  return Math.round((t.getTime() - new Date(toDateStr(d) + "T12:00:00").getTime()) / 86400000);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = dateStr.length <= 10 || STAMP.test(dateStr) ? new Date(dateStr.slice(0, 10) + "T12:00:00") : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  // "Nov 3" this year, "Nov 3, 2025" otherwise. Used for every date in the UI.
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

export const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

/** Lists stored in a cell: newline- or comma-separated. */
export function splitList(value: string, sep: "comma" | "line" = "comma"): string[] {
  if (!value) return [];
  const parts = sep === "line" ? value.split(/\n+/) : value.split(/[,\n]+/);
  return parts.map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

export const isTrue = (v: string) => /^(true|yes|1|x|✓)$/i.test((v || "").trim());

export const normEmail = (e: string) => (e || "").trim().toLowerCase();

/** Fill {placeholders} in a template. Unknown placeholders are left as-is. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return (text || "").replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}

/** "just now", "5m ago", "2h ago", "3d ago", or a date for anything older than a week. */
export function timeAgo(iso: string): string {
  const t = parseStamp(iso).getTime();
  if (isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)}d ago`;
  return formatDate(STAMP.test(iso) ? iso.slice(0, 10) : stamp(new Date(t)).slice(0, 10));
}
