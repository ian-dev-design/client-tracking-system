import { NextResponse } from "next/server";
import { checkAutoUrgent } from "@/lib/notify";
import { sendDigests } from "@/lib/digest";
import { runWithContext } from "@/lib/requestContext";

// Daily job (vercel.json → crons). Protected: needs "Authorization: Bearer <CRON_SECRET>",
// which Vercel Cron sends automatically once CRON_SECRET is set in the project's env vars.
// 1. Emails anyone whose task just became urgent (3+ days overdue).
// 2. Sends the weekly digest to people whose digest day is today.
// Emails go from the designated sender (NOTIFY_SENDER_EMAIL / NOTIFY_SENDER_REFRESH_TOKEN).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWithContext({ system: true }, async () => {
    await checkAutoUrgent();
    return sendDigests();
  });
  return NextResponse.json({ ok: true, digests: result });
}
