import { updateDraft } from "@/lib/crm";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Save edits to a pending draft, or discard it ({ status: "discarded" }).
export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const { subject, body, short_body, status } = await req.json();
  const patch: Record<string, string> = {};
  if (subject !== undefined) patch.subject = subject;
  if (body !== undefined) patch.body = body;
  if (short_body !== undefined) patch.short_body = short_body;
  if (status === "discarded" || status === "pending") patch.status = status;
  return updateDraft(id, patch, user.name);
});
