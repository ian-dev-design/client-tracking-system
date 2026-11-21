// One-time migration for data saved before onboarding stages and stage history existed.
// Run `setup-sheet` first (adds the new tabs and columns), then `migrate-process` (dry run) and
// `migrate-process --apply`. It only FILLS BLANK cells and ADDS rows: it never deletes, overwrites or reorders.

import { store, type Row } from "@/lib/data";
import { ONBOARDING_STAGES, currentStage, enteredCol } from "@/lib/onboarding";
import { newId, nowStamp } from "@/lib/util";

const MOVE = /^(Stage|Research status): (.*) → (.+?)(?: \(.*\))?$/;

export async function migrateProcess(apply: boolean, actor: string) {
  const s = store();
  const [contacts, onboarding, interactions, history] = await Promise.all([
    s.list("contacts"), s.list("onboarding"), s.list("interactions"), s.list("stage_history"),
  ]);
  const plan: string[] = [];
  let changed = 0;

  // 1. Onboarding rows: current stage from the checklist, and when they entered it.
  for (const o of onboarding) {
    const patch: Row = {};
    const stage = currentStage(o); // infers from checked steps when onboarding_stage is blank
    if (!o.onboarding_stage) patch.onboarding_stage = stage.key;
    const first = ONBOARDING_STAGES[0].key;
    if (!o[enteredCol(first)] && o.start_date) patch[enteredCol(first)] = `${o.start_date} 09:00`;
    if (!o[enteredCol(stage.key)]) patch[enteredCol(stage.key)] = o.updated_at || (o.start_date && `${o.start_date} 09:00`) || nowStamp();
    if (!Object.keys(patch).length) continue;
    const who = contacts.find((c) => c.id === o.contact_id)?.name || o.contact_id;
    plan.push(`onboarding ${o.id} (${who}): ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    if (apply) await s.update("onboarding", o.id, { ...patch, updated_at: nowStamp(), updated_by: actor });
    changed++;
  }

  // 2. Stage history from the "Stage: A → B" notes already in the timeline (for contacts with no history yet).
  const hasHistory = new Set(history.map((h) => h.contact_id));
  const rows: Row[] = [];
  for (const i of interactions.filter((x) => !hasHistory.has(x.contact_id)).sort((a, b) => (a.created_at || a.date).localeCompare(b.created_at || b.date))) {
    const m = MOVE.exec(i.summary || "");
    if (!m) continue;
    rows.push({
      id: newId("sh"), contact_id: i.contact_id, track: m[1] === "Stage" ? "pipeline" : "research",
      from_stage: m[2] === "—" ? "" : m[2], to_stage: m[3], at: i.created_at || `${i.date} 09:00`, by: i.logged_by || "",
    });
  }
  // Contacts with no notes at all still get one row for the stage they're in now (dated when they were added).
  const covered = new Set(rows.map((r) => r.contact_id));
  for (const c of contacts.filter((x) => !hasHistory.has(x.id) && !covered.has(x.id) && x.stage)) {
    rows.push({ id: newId("sh"), contact_id: c.id, track: "pipeline", from_stage: "", to_stage: c.stage, at: c.created_at || nowStamp(), by: c.updated_by || "" });
  }
  if (rows.length) plan.push(`stage_history: add ${rows.length} rows (from timeline notes and current stages)`);
  if (apply) for (const r of rows) await s.insert("stage_history", r);

  return { applied: apply, onboardingRowsUpdated: changed, historyRowsAdded: rows.length, plan };
}
