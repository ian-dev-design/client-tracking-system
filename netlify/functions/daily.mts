// Netlify Scheduled Function: runs once a day and calls the app's protected daily job,
// /api/cron/daily, with CRON_SECRET. That job:
//   1. emails anyone whose task just became urgent (3+ days overdue)
//   2. sends the weekly digest to teammates whose digest day is today
// Scheduled functions only run on the live (published) site, not locally or on previews.
// Test it by hand from Netlify: Logs → Functions → daily → "Run now".

export default async () => {
  const site = process.env.URL; // the site's main URL, set by Netlify
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.error("Daily job skipped: CRON_SECRET is not set in Netlify's environment variables.");
    return;
  }
  const res = await fetch(`${site}/api/cron/daily`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log(`Daily job: ${res.status} ${await res.text()}`);
};

// 15:00 UTC = 7 am Pacific in winter, 8 am in summer.
export const config = { schedule: "0 15 * * *" };
