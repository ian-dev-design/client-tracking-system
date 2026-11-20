import { ensureRetentionRow, toggleRetentionSignal, updateRetention } from "@/lib/crm";
import { withUser } from "@/lib/api";

// { id | contactId, signal } toggles a retention signal. { id | contactId, notes } updates the notes.
// If the customer has no retention row yet (moved to Active before rows existed), one is created.
export const POST = withUser(async (req, user) => {
  const { id, contactId, signal, notes } = await req.json();
  const rowId = id || (await ensureRetentionRow(contactId, user.name)).id;
  if (signal) return toggleRetentionSignal(rowId, signal, user.name);
  return updateRetention(rowId, { notes: notes ?? "" }, user.name);
});
