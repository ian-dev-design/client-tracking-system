import { convertToProspect, moveStage, renewClient, updateContact } from "@/lib/crm";
import { moveToOnboarding } from "@/lib/outreach";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Update a contact. Stage-only changes (board drag) also leave a note in the timeline.
// { action: "convert" } turns a research participant into a prospect.
// { action: "start_onboarding" } moves to Onboarding, creates the checklist and drafts a welcome email.
// { action: "renew", renewal_date } records a renewal and the next renewal date.
export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await req.json();
  if (body.action === "convert") return convertToProspect(id, user.name);
  if (body.action === "start_onboarding") return moveToOnboarding(id, user.name);
  if (body.action === "renew") return renewClient(id, body.renewal_date, user.name);
  const keys = Object.keys(body).filter((k) => k !== "lost_reason");
  if (keys.length === 1 && (keys[0] === "stage" || keys[0] === "research_status")) {
    return moveStage(id, keys[0], body[keys[0]], user.name, body.lost_reason || "");
  }
  return updateContact(id, body, user.name);
});
