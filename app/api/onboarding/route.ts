import { completeOnboarding, ensureOnboardingRow, moveOnboardingStage, toggleOnboardingStep, updateOnboarding } from "@/lib/crm";
import { withUser } from "@/lib/api";

const FIELDS = ["health", "blockers", "handoff_notes", "success_goals"];

// One endpoint for everything on an onboarding row. Pass `id` (the row) or `contactId` (the row is created if missing).
//   { contactId, moveTo: "<stage key>" }   move to another stage (board drag / "Move to next stage")
//   { contactId, complete: true }           finish onboarding → Active / Retention
//   { id | contactId, step: "<step key>" }  check / uncheck a checklist step
//   { id | contactId, health?, blockers?, handoff_notes?, success_goals? }
export const POST = withUser(async (req, user) => {
  const body = await req.json();
  if (body.moveTo) return moveOnboardingStage(body.contactId, body.moveTo, user.name);
  if (body.complete) return completeOnboarding(body.contactId, user.name);
  const rowId = body.id || (await ensureOnboardingRow(body.contactId, user.name)).id;
  if (body.step) return toggleOnboardingStep(rowId, body.step, user.name);
  const patch: Record<string, string> = {};
  for (const f of FIELDS) if (typeof body[f] === "string") patch[f] = body[f];
  if (!Object.keys(patch).length) throw new Error("Nothing to update");
  return updateOnboarding(rowId, patch, user.name);
});
