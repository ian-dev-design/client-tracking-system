import { NextResponse } from "next/server";
import { checkAutoUrgent } from "@/lib/notify";
import { sendDigests } from "@/lib/digest";
import { runWithContext } from "@/lib/requestContext";
import { refreshHealthStatuses } from "@/lib/crm";

// Daily job, called once a day by the Netlify Scheduled Function in netlify/functions/daily.mts.
// Protected: needs "Authorization: Bearer <CRON_SECRET>" (CRON_SECRET is set in Netlify's env vars).
// 1. Emails anyone whose task just became urgent (3+ days overdue).
// 2. Sends the weekly digest to people whose digest day is today.
// 3. Saves each retention client's current health to health_status.
// Emails go from the designated sender (NOTIFY_SENDER_EMAIL / NOTIFY_SENDER_REFRESH_TOKEN).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWithContext({ system: true }, async () => {
    await checkAutoUrgent();
    await refreshHealthStatuses(); // 3. keeps each retention client's health_status current in the Sheet
    return sendDigests();
  });
  return NextResponse.json({ ok: true, digests: result });
}
