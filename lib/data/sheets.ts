import { config } from "@/lib/config";
import { sheetsClient } from "@/lib/google";
import { newId, nowIso } from "@/lib/util";
import { RAW_SURVEY_TAB, TABLES, type Row, type TableName } from "./schema";
import type { RawSurveyResponse, Store } from "./types";
import { parseRawSurveyRows } from "./raw-survey";

// Google Sheets adapter. Each tab = table, row 1 = headers. Columns are matched by
// header name, so reordering columns in the Sheet is safe.

const CACHE_MS = 15_000; // keeps us well under the Sheets read quota
const cache = new Map<string, { at: number; values: string[][] }>();

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

async function readTab(tab: string): Promise<string[][]> {
  const hit = cache.get(tab);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.values;
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
  organizations: "org", sites: "site", tasks: "task", transcripts: "tr",
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
        row.created_at = nowIso();
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
    await sheetsClient().spreadsheets.values.append({
      spreadsheetId: sheetId(),
      range: table,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [headers.map((h) => row[h] ?? "")] },
    });
    invalidate(table);
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
  // Add any missing header columns (never removes or reorders existing ones).
  for (const [table, cols] of Object.entries(TABLES)) {
    invalidate(table);
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
