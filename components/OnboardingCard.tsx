"use client";

// The interactive parts of onboarding: stepper, current-stage checklist with the one primary button,
// health, and the notes fields. Used by the onboarding detail page and the "Work on this" page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingView } from "@/lib/onboarding";
import { formatDate } from "@/lib/util";
import { postJson } from "./Modal";
import { Spinner } from "./ui";
import { toast } from "./Toast";

export type { OnboardingView };

/** Posts to /api/onboarding for this client (the row is created on the first change if it doesn't exist yet). */
function useOnboarding(view: OnboardingView) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const save = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      await postJson("/api/onboarding", { id: view.rowId || undefined, contactId: view.contactId, ...body });
      if (done) toast(done);
      router.refresh();
      return true;
    } catch (e) { alert((e as Error).message); return false; } finally { setBusy(false); }
  };
  return { busy, save, router };
}

// Health: green = success, yellow = amber, red = coral.
const HEALTH_TEXT: Record<string, string> = { green: "text-success", yellow: "text-amber-ink", red: "text-coral" };

export function HealthSelect({ view }: { view: OnboardingView }) {
  const { busy, save } = useOnboarding(view);
  return (
    <select aria-label="Health" disabled={busy} value={view.health} onChange={(e) => save({ health: e.target.value }, "Health updated")}
      className={`input w-auto py-1 text-sm font-medium ${HEALTH_TEXT[view.health] || HEALTH_TEXT.green}`}>
      <option value="green">● Healthy</option><option value="yellow">● Needs attention</option><option value="red">● At risk</option>
    </select>
  );
}

/** Horizontal stepper across the stages: done ✓, current highlighted in amber, upcoming muted. */
export function Stepper({ view }: { view: OnboardingView }) {
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Onboarding stages">
      {view.stages.map((s, i) => {
        const cls = s.state === "current" ? "bg-onboarding/25 text-ink shadow-[inset_0_-2px_0_var(--color-onboarding)]"
          : s.state === "done" ? "bg-onboarding/10 text-onboarding-ink" : "bg-wash text-muted";
        return (
          <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className={`min-w-0 px-2.5 py-2 ${cls}`} title={s.description}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]">
              <span aria-hidden>{s.state === "done" ? "✓" : i + 1}</span><span className="truncate">{s.label}</span>
            </div>
            <div className="mt-0.5 text-xs tabular-nums">
              {s.days !== null ? `${s.days} day${s.days === 1 ? "" : "s"}${s.state === "current" ? " so far" : ""}` : s.state === "next" ? "—" : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Steps({ view, stageKey, busy, onToggle }: { view: OnboardingView; stageKey: string; busy: boolean; onToggle: (key: string) => void }) {
  const stage = view.stages.find((s) => s.key === stageKey)!;
  return (
    <ul className="space-y-1.5">
      {stage.steps.map((s) => (
        <li key={s.key}>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-forest" checked={s.done} disabled={busy} onChange={() => onToggle(s.key)} />
            <span className={s.done ? "text-faint line-through" : "text-ink"}>{s.label}</span>
            {s.date && <span className="text-xs text-faint">{formatDate(s.date)}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** The current stage: what it means, its checklist, and the one primary button. Other stages' steps fold away below. */
export function StageChecklist({ view, showOthers = true }: { view: OnboardingView; showOthers?: boolean }) {
  const { busy, save, router } = useOnboarding(view);
  const idx = view.stages.findIndex((s) => s.key === view.stageKey);
  const cur = view.stages[idx];
  const next = view.stages[idx + 1];
  const toggle = (step: string) => save({ step });
  const advance = async () => {
    if (view.isLast) {
      if (!confirm(`Onboarding done? ${view.name} moves to Retention.`)) return;
      if (await save({ complete: true }, `${view.name} moved to Retention`)) router.push("/retention");
      return;
    }
    const open = cur.steps.filter((s) => !s.done).length;
    if (open && !confirm(`${open} step${open === 1 ? " is" : "s are"} still open in ${cur.label}. Move ${view.name} to ${next.label} anyway?`)) return;
    await save({ moveTo: next.key }, `Moved ${view.name} to ${next.label}`);
  };
  return (
    <div className="space-y-5">
      <div className="border border-l-[3px] border-line border-l-onboarding bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{cur.label}</h2>
          <span className="text-xs tabular-nums text-muted">{view.done} of {view.total} done</span>
        </div>
        <p className="mt-1 text-sm text-muted">{cur.description}</p>
        <div className="mt-4"><Steps view={view} stageKey={cur.key} busy={busy} onToggle={toggle} /></div>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <button className="btn btn-primary" disabled={busy} onClick={advance}>
            {busy && <Spinner />}{view.isLast ? "Complete onboarding → Move to Retention" : `Move to next stage: ${next.label} →`}
          </button>
        </div>
      </div>
      {showOthers && (
        <details className="group text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Steps in other stages</summary>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {view.stages.filter((s) => s.key !== cur.key).map((s) => (
              <div key={s.key}>
                <div className="label">{s.label}</div>
                <Steps view={view} stageKey={s.key} busy={busy} onToggle={toggle} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const FIELD_INFO = {
  handoff_notes: { label: "Handoff notes", placeholder: "What was promised, key contacts, their goals…", value: (v: OnboardingView) => v.handoffNotes },
  success_goals: { label: "Success goals", placeholder: "What a win looks like for this client…", value: (v: OnboardingView) => v.successGoals },
  blockers: { label: "Blockers", placeholder: "None", value: (v: OnboardingView) => v.blockers },
} as const;
type FieldKey = keyof typeof FIELD_INFO;

/** A notes field that saves when you click away. */
export function OnboardingField({ view, field }: { view: OnboardingView; field: FieldKey }) {
  const info = FIELD_INFO[field];
  const { busy, save } = useOnboarding(view);
  const [value, setValue] = useState(info.value(view));
  const id = `ob-${field}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{info.label}{busy && <span className="ml-2 normal-case"><Spinner /></span>}</label>
      <textarea id={id} className={`input min-h-20 resize-y leading-snug ${field === "blockers" && value ? "border-coral/50" : ""}`}
        value={value} placeholder={info.placeholder} onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== info.value(view) && save({ [field]: value }, `${info.label} saved`)} />
    </div>
  );
}
