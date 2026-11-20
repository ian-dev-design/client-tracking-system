import { saveSettings } from "@/lib/notify";
import { withUser } from "@/lib/api";

// Save your own notification settings.
export const POST = withUser(async (req, user) => {
  const b = await req.json();
  await saveSettings(user.email, {
    assign_email: !!b.assign_email, urgent_email: !!b.urgent_email, digest_email: !!b.digest_email, digest_day: String(b.digest_day || "Mon"),
  });
  return { ok: true };
});
