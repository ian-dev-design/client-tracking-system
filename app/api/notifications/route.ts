import { markRead } from "@/lib/notify";
import { withUser } from "@/lib/api";

// Mark your notifications read: { id } for one, {} for all.
export const POST = withUser(async (req, user) => {
  const body = await req.json().catch(() => ({}));
  await markRead(user.email, body.id ? String(body.id) : undefined);
  return { ok: true };
});
