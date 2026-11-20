import { recordOutreachSent } from "@/lib/crm";
import { CHANNELS } from "@/lib/data";
import { withUser } from "@/lib/api";

// After copying text and sending it yourself (LinkedIn, iMessage, ...): log it + set follow-up.
export const POST = withUser(async (req, user) => {
  const { contactId, channel, body, draftId } = await req.json();
  if (!(CHANNELS as readonly string[]).includes(channel)) throw new Error("Pick a channel");
  await recordOutreachSent({ contactId, channel, body, draftId }, user.name);
  return { ok: true };
});
