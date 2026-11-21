// Onboarding as a process: five stages from config.json (onboardingStages), each with its own checklist.
// Pure helpers (no storage), so pages, the CLI and the Insights page all agree.

import { ONBOARDING_STAGES, type OnboardingStage } from "@/lib/target";
import { isTrue, parseStamp } from "@/lib/util";

type Row = Record<string, string>;

export { ONBOARDING_STAGES };
export type { OnboardingStage };

/** Column holding when a client last entered a stage, e.g. "setup_entered_at". */
export const enteredCol = (stageKey: string) => `${stageKey}_entered_at`;

export const stageByKey = (key: string) => ONBOARDING_STAGES.find((s) => s.key === key);
export const stageIndex = (key: string) => ONBOARDING_STAGES.findIndex((s) => s.key === key);

/**
 * The stage a client is in. Rows saved before stages existed have no onboarding_stage, and older checklists
 * don't have the newer steps, so go by the furthest work done: the last stage with a checked step
 * (or the next stage, if every step there is checked). Nothing checked = the first stage.
 */
export function currentStage(row: Row): OnboardingStage {
  const saved = stageByKey(row.onboarding_stage || "");
  if (saved) return saved;
  let i = -1;
  ONBOARDING_STAGES.forEach((s, n) => { if (s.steps.some((st) => isTrue(row[st.key]))) i = n; });
  if (i < 0) return ONBOARDING_STAGES[0];
  const allDone = ONBOARDING_STAGES[i].steps.every((st) => isTrue(row[st.key]));
  return ONBOARDING_STAGES[allDone ? Math.min(i + 1, ONBOARDING_STAGES.length - 1) : i];
}

/** Checked steps in one stage, e.g. { done: 1, total: 2 }. */
export function stageProgress(row: Row, stage: OnboardingStage) {
  return { done: stage.steps.filter((s) => isTrue(row[s.key])).length, total: stage.steps.length };
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => (parseStamp(to).getTime() - parseStamp(from).getTime()) / DAY;
const asStamp = (v: string) => (v && v.length === 10 ? `${v} 09:00` : v); // a bare date counts from 9am

/** When the client entered their current stage (falls back to the onboarding start date). */
export function enteredAt(row: Row): string {
  return asStamp(row[enteredCol(currentStage(row).key)] || row.start_date || row.created_at || "");
}

/** Whole days in the current stage, or null if unknown. */
export function daysInStage(row: Row, now = new Date()): number | null {
  const at = enteredAt(row);
  if (!at) return null;
  const d = (now.getTime() - parseStamp(at).getTime()) / DAY;
  return Number.isNaN(d) ? null : Math.max(0, Math.floor(d));
}

/**
 * Days spent in each stage the client has finished: from entering it to entering the next one
 * (or to completed_at for the last stage). Stages without both timestamps are left out.
 */
export function stageDurations(row: Row): Record<string, number> {
  const out: Record<string, number> = {};
  ONBOARDING_STAGES.forEach((s, i) => {
    const start = asStamp(row[enteredCol(s.key)] || (i === 0 ? row.start_date : ""));
    const next = ONBOARDING_STAGES[i + 1];
    const end = asStamp(next ? row[enteredCol(next.key)] : row.completed_at);
    if (!start || !end) return;
    const d = daysBetween(start, end);
    if (!Number.isNaN(d) && d >= 0) out[s.key] = d;
  });
  return out;
}

/** Days from handoff to first value, or null. */
export function daysToFirstValue(row: Row): number | null {
  const start = asStamp(row[enteredCol(ONBOARDING_STAGES[0].key)] || row.start_date);
  const fv = ONBOARDING_STAGES.find((s) => s.key === "first_value") || ONBOARDING_STAGES[3];
  const end = fv && asStamp(row[enteredCol(fv.key)]);
  if (!start || !end) return null;
  const d = daysBetween(start, end);
  return Number.isNaN(d) || d < 0 ? null : d;
}

// ---------- What the board card and the detail page show ----------

export type StageView = {
  key: string; label: string; description: string; state: "done" | "current" | "next"; days: number | null;
  steps: { key: string; label: string; done: boolean; date: string }[];
};
export type OnboardingView = {
  rowId: string; // "" until the row exists (the API creates it on the first change)
  contactId: string; name: string; company: string; owner: string; value: number;
  health: string; blockers: string; handoffNotes: string; successGoals: string;
  stageKey: string; stageLabel: string; days: number | null; done: number; total: number;
  isLast: boolean; startDate: string; stages: StageView[];
  urgency?: { level: "red" | "amber"; text: string } | null;
};

/** Everything about one client's onboarding, from their onboarding row (may be missing) and contact. */
export function onboardingView(o: Row | undefined, c: Row, value = 0): OnboardingView {
  const row = o || {};
  const cur = currentStage(row);
  const curIdx = stageIndex(cur.key);
  const durs = stageDurations(row);
  const days = daysInStage(row);
  const { done, total } = stageProgress(row, cur);
  return {
    rowId: row.id || "", contactId: c.id, name: c.name, company: c.company || "", owner: c.owner || "", value,
    health: row.health || "green", blockers: row.blockers || "", handoffNotes: row.handoff_notes || "", successGoals: row.success_goals || "",
    stageKey: cur.key, stageLabel: cur.label, days, done, total, isLast: curIdx === ONBOARDING_STAGES.length - 1,
    startDate: row.start_date || "",
    stages: ONBOARDING_STAGES.map((s, i) => ({
      key: s.key, label: s.label, description: s.description,
      state: i < curIdx ? "done" : i === curIdx ? "current" : "next",
      days: i === curIdx ? days : durs[s.key] !== undefined ? Math.round(durs[s.key]) : null,
      steps: s.steps.map((st) => ({ key: st.key, label: st.label, done: isTrue(row[st.key]), date: row[`${st.key}_date`] || "" })),
    })),
  };
}
