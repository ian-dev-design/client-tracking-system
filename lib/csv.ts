// CSV export and import for contacts. Import checks for duplicates by email before anything is saved.

import { createContact, loadAll } from "@/lib/crm";
import { CONTACT_TYPES, PIPELINE_STAGES, RESEARCH_STATUSES, type Row } from "@/lib/data";
import { normEmail } from "@/lib/util";

/** Columns in the export, and the ones import understands (plus the aliases below). */
export const CSV_COLUMNS = [
  "name", "email", "company", "role", "phone", "linkedin", "source", "contact_type", "stage", "research_status",
  "owner", "fit_score", "next_followup_date", "quote_amount", "deal_value", "expected_close_date", "deal_status", "notes",
];
const HEADER_LABEL: Record<string, string> = { company: "organization" };
const ALIASES: Record<string, string> = {
  organization: "company", org: "company", fullname: "name", type: "contact_type", followup: "next_followup_date",
  nextfollowup: "next_followup_date", title: "role", value: "deal_value", quote: "quote_amount", closedate: "expected_close_date",
};

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function contactsToCsv(contacts: Row[]): string {
  const header = CSV_COLUMNS.map((c) => HEADER_LABEL[c] || c);
  const lines = contacts.map((c) => CSV_COLUMNS.map((col) => cell(c[col] || "")).join(","));
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

/** Parse CSV text (quoted fields, commas and newlines inside quotes) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, ""); // strip Excel's byte-order mark
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const COLUMN_BY_KEY = Object.fromEntries(CSV_COLUMNS.map((c) => [key(c), c]));

/** Turn CSV text into contact rows, matching headers like "Organization" or "Full name" to our columns. */
export function csvToContacts(text: string): { rows: Row[]; ignoredColumns: string[] } {
  const [header = [], ...lines] = parseCsv(text);
  const map = header.map((h) => COLUMN_BY_KEY[key(h)] || ALIASES[key(h)] || "");
  const rows = lines.map((line) => {
    const r: Row = {};
    map.forEach((col, i) => { if (col && line[i]?.trim()) r[col] = line[i].trim(); });
    return r;
  });
  return { rows, ignoredColumns: header.filter((_, i) => !map[i]) };
}

export type ImportCheck = { row: Row; status: "new" | "duplicate" | "invalid"; reason?: string; existingId?: string };

/** Check each row before importing: needs a name, and its email must not already exist (in the CRM or earlier in the file). */
export async function checkImport(rows: Row[]): Promise<ImportCheck[]> {
  const { contacts } = await loadAll();
  const known = new Map(contacts.filter((c) => c.email).map((c) => [normEmail(c.email), c]));
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.name) return { row, status: "invalid", reason: "No name" };
    const email = normEmail(row.email || "");
    if (email && known.has(email)) return { row, status: "duplicate", reason: `Already in the CRM as ${known.get(email)!.name}`, existingId: known.get(email)!.id };
    if (email && seen.has(email)) return { row, status: "duplicate", reason: "Appears earlier in this file" };
    if (email) seen.add(email);
    return { row, status: "new" };
  });
}

/** Import only the rows that check out as new. Unknown stage/type values fall back to the defaults. */
export async function importContacts(rows: Row[], actor: string) {
  const checks = await checkImport(rows);
  const created: Row[] = [];
  for (const { row, status } of checks) {
    if (status !== "new") continue;
    const clean = { ...row };
    if (clean.contact_type && !(CONTACT_TYPES as readonly string[]).includes(clean.contact_type)) delete clean.contact_type;
    if (clean.stage && !(PIPELINE_STAGES as readonly string[]).includes(clean.stage)) delete clean.stage;
    if (clean.research_status && !(RESEARCH_STATUSES as readonly string[]).includes(clean.research_status)) delete clean.research_status;
    if (!clean.source) clean.source = "CSV import";
    created.push(await createContact(clean, actor));
  }
  return { created: created.length, skipped: checks.length - created.length };
}
