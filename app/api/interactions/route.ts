import { logInteraction, moveStage, updateContact } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Log any interaction; optionally change stage and next follow-up in the same step.
export const POST = withUser(async (req, user) => {
  const { contact_id, type, channel, summary, date, stage, research_status, next_followup_date } = await req.json();
  const row = await logInteraction({ contact_id, type, channel, summary, date }, user.name);
  if (stage) await moveStage(contact_id, "stage", stage, user.name);
  if (research_status) await moveStage(contact_id, "research_status", research_status, user.name);
  if (next_followup_date) await updateContact(contact_id, { next_followup_date }, user.name);
  return row;
});
