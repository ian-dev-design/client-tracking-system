// Small helpers shared by the app and the CLI.

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export const nowIso = () => new Date().toISOString();

/** Today's date as YYYY-MM-DD in local time. */
export function today(): string {
  return toDateStr(new Date());
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
  const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
  if (isNaN(d.getTime())) return null;
  const t = new Date(today() + "T12:00:00");
  return Math.round((t.getTime() - new Date(toDateStr(d) + "T12:00:00").getTime()) / 86400000);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length <= 10 ? dateStr + "T12:00:00" : dateStr);
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
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)}d ago`;
  return formatDate(iso.slice(0, 10));
}
