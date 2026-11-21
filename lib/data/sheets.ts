import { config } from "@/lib/config";
import { sheetsClient } from "@/lib/google";
import { newId, nowStamp, stamp } from "@/lib/util";
import { RAW_SURVEY_TAB, TABLES, type Row, type TableName } from "./schema";
import type { RawSurveyResponse, Store } from "./types";
import { parseRawSurveyRows } from "./raw-survey";

// Google Sheets adapter. Each tab = table, row 1 = headers. Columns are matched by
// header name, so reordering columns in the Sheet is safe.

// Google allows 60 read requests per minute. A page needs ~14 tabs, so on a cache miss we fetch
// every tab in ONE batch request, share it between requests running at the same time, and keep it
// for 30s. Our own writes update or clear the cache, so only edits made directly in the Sheet wait.
const CACHE_MS = 30_000;
type Cached = { at: number; values: string[][] };
const g = globalThis as unknown as { __sheetsCache?: Map<string, Cached>; __sheetsBatch?: Promise<void> | null; __sheetsMissing?: Set<string> };
const cache = (g.__sheetsCache ??= new Map<string, Cached>()); // survives dev hot reloads

function sheetId() {
  if (!config.spreadsheetId) throw new Error("spreadsheetId is empty in config.json");
  return config.spreadsheetId;
}

function colLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

// Tabs the app knows about but the Sheet doesn't have yet (added by a newer version, before setup-sheet runs).
// They read as empty, so the app keeps working until setup-sheet adds them.
const missing = () => (g.__sheetsMissing ??= new Set<string>());

async function fetchAllTabs(): Promise<void> {
  const batch = (tabs: string[]) => sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: sheetId(), ranges: tabs, valueRenderOption: "FORMATTED_VALUE",
  });
  let tabs = Object.keys(TABLES).filter((t) => !missing().has(t));
  let res;
  try {
    res = await batch(tabs);
  } catch (err) {
    // One missing tab fails the whole batch: find out which tabs exist, then read just those.
    const meta = await sheetsClient().spreadsheets.get({ spreadsheetId: sheetId(), fields: "sheets.properties.title" });
    const have = new Set(meta.data.sheets?.map((s) => s.properties?.title) || []);
    const absent = Object.keys(TABLES).filter((t) => !have.has(t));
    if (!absent.length) throw err;
    absent.forEach((t) => missing().add(t));
    tabs = tabs.filter((t) => have.has(t));
    res = await batch(tabs);
  }
  const at = Date.now();
  (res.data.valueRanges || []).forEach((vr, i) => cache.set(tabs[i], { at, values: (vr.values as string[][]) || [] }));
  missing().forEach((t) => cache.set(t, { at, values: [] }));
}

async function readTab(tab: string): Promise<string[][]> {
  if (missing().has(tab)) return [];
  const hit = cache.get(tab);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.values;
  if (tab in TABLES) {
    try {
      g.__sheetsBatch ??= fetchAllTabs().finally(() => (g.__sheetsBatch = null));
      await g.__sheetsBatch;
      const fresh = cache.get(tab);
      if (fresh) return fresh.values;
    } catch {
      // e.g. a tab doesn't exist yet (before setup-sheet): fall back to reading just this one
    }
  }
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: tab,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values as string[][]) || [];
  cache.set(tab, { at: Date.now(), values });
  return values;
}

const invalidate = (tab: string) => cache.delete(tab);

function toRows(values: string[][]): { headers: string[]; rows: Row[] } {
  const headers = (values[0] || []).map((h) => String(h).trim());
  const rows = values.slice(1).map((line) => {
    const row: Row = {};
    headers.forEach((h, i) => (row[h] = line[i] != null ? String(line[i]) : ""));
    return row;
  });
  return { headers, rows };
}

const PREFIX: Record<TableName, string> = {
  contacts: "c", interactions: "int", surveys: "sv", interviews: "iv", research_themes: "th",
  interview_guides: "g", email_templates: "t", onboarding: "ob", retention: "rt", drafts: "d", activity_log: "log",
  organizations: "org", sites: "site", tasks: "task", transcripts: "tr", notifications: "n", notification_settings: "ns", stage_history: "sh",
};
const prefixFor = (table: TableName) => PREFIX[table];

export const sheetsStore: Store = {
  async list(table) {
    const { headers, rows } = toRows(await readTab(table));
    // Fill in id / created_at for rows someone typed in by hand.
    const fixes: { range: string; values: string[][] }[] = [];
    const idCol = headers.indexOf("id");
    const createdCol = headers.indexOf("created_at");
    rows.forEach((row, i) => {
      const hasData = Object.values(row).some((v) => v.trim());
      if (!hasData) return;
      const sheetRow = i + 2;
      if (idCol >= 0 && !row.id) {
        row.id = newId(prefixFor(table));
        fixes.push({ range: `${table}!${colLetter(idCol)}${sheetRow}`, values: [[row.id]] });
      }
      if (createdCol >= 0 && !row.created_at) {
        row.created_at = nowStamp();
        fixes.push({ range: `${table}!${colLetter(createdCol)}${sheetRow}`, values: [[row.created_at]] });
      }
    });
    if (fixes.length) {
      await sheetsClient().spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId(),
        requestBody: { valueInputOption: "RAW", data: fixes },
      });
      invalidate(table);
    }
    return rows.filter((r) => Object.values(r).some((v) => v.trim()));
  },

  async insert(table, row) {
    const values = await readTab(table);
    const headers = (values[0] as string[]) || [...TABLES[table]];
    const line = headers.map((h) => row[h] ?? "");
    await sheetsClient().spreadsheets.values.append({
      spreadsheetId: sheetId(),
      range: table,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [line] },
    });
    // Add the row to our cached copy instead of re-reading the whole tab (saves a read per insert,
    // which keeps bulk work like imports under the Sheets per-minute read limit).
    const hit = cache.get(table);
    if (hit) hit.values = [...hit.values, line];
    return row;
  },

  async update(table, id, patch) {
    invalidate(table);
    const values = await readTab(table);
    const { headers, rows } = toRows(values);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`${table}: no row with id ${id}`);
    const merged = { ...rows[index], ...patch };
    const sheetRow = index + 2;
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${table}!A${sheetRow}:${colLetter(headers.length - 1)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [headers.map((h) => merged[h] ?? "")] },
    });
    invalidate(table);
    return merged;
  },

  async listRawSurveyResponses(): Promise<RawSurveyResponse[]> {
    try {
      return parseRawSurveyRows(await readTab(RAW_SURVEY_TAB));
    } catch {
      return []; // tab not linked yet
    }
  },
};

/** Used by setup-sheet: make sure every tab exists with the right header row. */
export async function ensureTabs(): Promise<string[]> {
  const sheets = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId() });
  const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title) || []);
  const created: string[] = [];
  const toAdd = Object.keys(TABLES).filter((t) => !existing.has(t));
  if (toAdd.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: {
        requests: toAdd.map((title) => ({
          addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
        })),
      },
    });
    created.push(...toAdd);
  }
  missing().clear();
  // Add any missing header columns (never removes or reorders existing ones).
  cache.clear(); // one fresh batch read covers every tab below
  for (const [table, cols] of Object.entries(TABLES)) {
    const values = await readTab(table);
    const headers = (values[0] || []).map(String);
    const missing = cols.filter((c) => !headers.includes(c));
    if (missing.length) {
      const all = [...headers, ...missing];
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId(),
        range: `${table}!A1:${colLetter(all.length - 1)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [all] },
      });
      invalidate(table);
    }
  }
  return created;
}

/**
 * One-time cleanup: rewrites old ISO timestamps (2026-11-20T21:05:56.764Z) in the timestamp columns
 * as "YYYY-MM-DD HH:MM". Only those cells are touched. Safe to re-run. Returns how many cells changed.
 */
export async function reformatTimestamps(): Promise<number> {
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  const data: { range: string; values: string[][] }[] = [];
  let changed = 0;
  cache.clear();
  for (const table of Object.keys(TABLES)) {
    const values = await readTab(table);
    const headers = (values[0] || []).map(String);
    for (const col of ["at", "created_at", "updated_at", "done_at"]) {
      const i = headers.indexOf(col);
      if (i < 0 || values.length < 2) continue;
      let any = false;
      const column = values.slice(1).map((line) => {
        const v = line[i] != null ? String(line[i]) : "";
        if (!ISO.test(v) || isNaN(new Date(v).getTime())) return [v];
        any = true; changed++;
        return [stamp(new Date(v))];
      });
      if (any) data.push({ range: `${table}!${colLetter(i)}2:${colLetter(i)}${values.length}`, values: column });
    }
  }
  if (data.length) {
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: { valueInputOption: "RAW", data },
    });
  }
  cache.clear();
  return changed;
}
