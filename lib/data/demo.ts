import fs from "node:fs";
import path from "node:path";
import { TABLES, type Row, type TableName } from "./schema";
import type { Store } from "./types";
import { buildSampleData } from "./sample";
import { parseRawSurveyRows } from "./raw-survey";

// Local JSON "database" for previewing without Google. Lives in .demo-data/ (git-ignored).
// Delete .demo-data/ (or run `npm run seed-demo`) to reset to the sample contacts.

const DIR = path.join(process.cwd(), ".demo-data");
const FILE = path.join(DIR, "db.json");
export const DEMO_TRANSCRIPTS_DIR = path.join(DIR, "transcripts");

type Db = { tables: Record<TableName, Row[]>; raw: string[][] };

export function resetDemoData(): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(buildSampleData(), null, 2));
}

function load(): Db {
  if (!fs.existsSync(FILE)) resetDemoData();
  const db = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  for (const t of Object.keys(TABLES) as TableName[]) db.tables[t] ||= [];
  return db;
}

function save(db: Db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const demoStore: Store = {
  async list(table) {
    // Like a Sheet row: every column is present, blank ones as "".
    const blank = Object.fromEntries(TABLES[table].map((col) => [col, ""]));
    return (load().tables[table] || []).map((r) => ({ ...blank, ...r })); // tables added later start empty
  },
  async insert(table, row) {
    const db = load();
    (db.tables[table] ||= []).push(row);
    save(db);
    return row;
  },
  async update(table, id, patch) {
    const db = load();
    const i = (db.tables[table] ||= []).findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`${table}: no row with id ${id}`);
    db.tables[table][i] = { ...db.tables[table][i], ...patch };
    save(db);
    return db.tables[table][i];
  },
  async listRawSurveyResponses() {
    return parseRawSurveyRows(load().raw);
  },
};
