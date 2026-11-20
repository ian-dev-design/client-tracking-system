import { sendDigests } from "@/lib/digest";
import { checkAutoUrgent } from "@/lib/notify";
import { withUser } from "@/lib/api";

// "Send weekly digest now" (Settings → Notifications): sends everyone's digest right away from your
// Gmail, and emails any newly urgent tasks. While EMAIL_TEST_REDIRECT is set, it all goes to you.
export const POST = withUser(async () => {
  await checkAutoUrgent();
  return { results: await sendDigests({ now: true }) };
});
