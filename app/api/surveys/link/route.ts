import { createContactFromResponse, linkResponse } from "@/lib/surveys";
import { withUser } from "@/lib/api";

// Resolve an unmatched survey response: link it to a contact, or create a new contact from it.
export const POST = withUser(async (req, user) => {
  const { key, contactId, create } = await req.json();
  if (create) return createContactFromResponse(key, user.name);
  await linkResponse(key, contactId, user.name);
  return { ok: true };
});
