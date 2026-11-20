import { buildDraft } from "@/lib/outreach";
import { withUser } from "@/lib/api";

// Returns a draft to review. Nothing is sent here.
export const POST = withUser(async (req, user) => {
  const { contactId, purpose } = await req.json();
  return buildDraft(contactId, user.name, purpose || undefined);
});
