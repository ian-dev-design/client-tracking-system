import { toggleOnboardingStep, updateOnboarding } from "@/lib/crm";
import { withUser } from "@/lib/api";

// { id, step } toggles a checklist item. { id, health, blockers } updates fields.
export const POST = withUser(async (req, user) => {
  const { id, step, health, blockers } = await req.json();
  if (step) return toggleOnboardingStep(id, step, user.name);
  const patch: Record<string, string> = {};
  if (health) patch.health = health;
  if (blockers !== undefined) patch.blockers = blockers;
  return updateOnboarding(id, patch, user.name);
});
