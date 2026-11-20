import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { getContact, recordOutreachSent } from "@/lib/crm";
import { sendGmail } from "@/lib/gmail";
import { withUser } from "@/lib/api";
import { gmailAccessToken } from "@/lib/auth";

// The ONLY code path that sends email. It runs only when a teammate clicks
// "Approve & send" on a draft they reviewed. Sends from that teammate's own Gmail.
export const POST = withUser(async (req, user) => {
  const { contactId, draftId, subject, body, approved } = await req.json();
  if (approved !== true) throw new Error("Sending requires clicking Approve & send.");
  if (!subject?.trim() || !body?.trim()) throw new Error("Subject and body are required.");
  const contact = await getContact(contactId);
  if (!contact) throw new Error("Contact not found");
  if (!contact.email) throw new Error("This contact has no email address. Use Copy text instead.");

  // Safety net while testing: every email goes to the test address instead.
  const redirect = process.env.EMAIL_TEST_REDIRECT?.trim();
  const to = redirect || contact.email;
  const finalSubject = redirect ? `[TEST → ${contact.email}] ${subject}` : subject;

  if (user.demo) {
    // Demo mode has no Gmail connection: log it as if sent so the flow can be previewed.
    await recordOutreachSent({ contactId, channel: "gmail", subject, body, draftId }, user.name);
    return { ok: true, demo: true, to };
  }

  const token = await getToken({ req: req as NextRequest, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = await gmailAccessToken(token);
  if (!accessToken) throw new Error("Your Gmail connection expired. Sign out (bottom of the sidebar) and sign in again, then retry.");
  await sendGmail({ accessToken, from: user.email, to, subject: finalSubject, body });
  await recordOutreachSent({ contactId, channel: "gmail", subject, body, draftId }, user.name);
  return { ok: true, to };
});
