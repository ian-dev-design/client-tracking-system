// One-time migration for data saved before onboarding stages and stage history existed.
// Run `setup-sheet` first (adds the new tabs and columns), then `migrate-process` (dry run) and
// `migrate-process --apply`. It only FILLS BLANK cells and ADDS rows: it never deletes, overwrites or reorders.
// Fills: onboarding stage + entered-at, stage history from timeline notes, tasks.completed_at, contacts.health_status.

import { store, type Row } from "@/lib/data";
import { clientHealth } from "@/lib/retention";
import { ONBOARDING_STAGES, currentStage, enteredCol } from "@/lib/onboarding";
import { newId, nowStamp } from "@/lib/util";

const MOVE = /^(Stage|Research status): (.*) → (.+?)(?: \(.*\))?$/;

export async function migrateProcess(apply: boolean, actor: string) {
  const s = store();
  const [contacts, onboarding, interactions, history, tasks] = await Promise.all([
    s.list("contacts"), s.list("onboarding"), s.list("interactions"), s.list("stage_history"), s.list("tasks"),
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
    // When they reached the current stage: the latest date a step in an earlier stage was checked (closest to the truth),
    // else their last update.
    const idx = ONBOARDING_STAGES.findIndex((x) => x.key === stage.key);
    const lastEarlier = ONBOARDING_STAGES.slice(0, idx).flatMap((x) => x.steps).map((st) => o[`${st.key}_date`]).filter(Boolean).sort().pop();
    if (!o[enteredCol(stage.key)] && !patch[enteredCol(stage.key)]) {
      patch[enteredCol(stage.key)] = (lastEarlier && `${lastEarlier} 09:00`) || o.updated_at || (o.start_date && `${o.start_date} 09:00`) || nowStamp();
    }
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

  // 3. Finished tasks: completed_at from done_at (the Team page's Efficiency tab reads completed_at).
  const finished = tasks.filter((t) => t.done_at && !t.completed_at);
  if (finished.length) plan.push(`tasks: fill completed_at from done_at on ${finished.length} finished tasks`);
  if (apply) for (const t of finished) await s.update("tasks", t.id, { completed_at: t.done_at });

  // 4. Retention clients: health_status (blank cells only).
  const health = contacts.filter((c) => c.stage === "Active / Retention" && !c.health_status);
  if (health.length) plan.push(`contacts: fill health_status for ${health.length} retention clients`);
  if (apply) for (const c of health) await s.update("contacts", c.id, { health_status: clientHealth(c, interactions, tasks).health });

  return { applied: apply, onboardingRowsUpdated: changed, historyRowsAdded: rows.length, tasksCompletedAt: finished.length, healthStatusFilled: health.length, plan };
}
