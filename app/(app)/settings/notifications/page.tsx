import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getSettings, DAILY_EMAIL_CAP } from "@/lib/notify";
import { team } from "@/lib/team";
import { NotificationSettingsForm, SendDigestNow, SenderPermission } from "@/components/NotificationSettings";
import { PageHeader, SectionHead } from "@/components/ui";

export default async function NotificationSettingsPage() {
  const user = await currentUser();
  const s = await getSettings(user?.email || "");
  const testRedirect = process.env.EMAIL_TEST_REDIRECT?.trim();
  const senderReady = !!(process.env.NOTIFY_SENDER_EMAIL && process.env.NOTIFY_SENDER_REFRESH_TOKEN);
  const preview = (type: string, label: string) => (
    <Link href={`/settings/notifications/preview?type=${type}`} className="btn btn-sm">{label}</Link>
  );

  return (
    <>
      <PageHeader title="Notifications" subtitle="What the CRM emails you about. You'll always see everything in the bell." />
      {testRedirect && (
        <div className="mb-8 border-l-[3px] border-amber bg-amber/10 px-4 py-2.5 text-sm">
          Test mode: every notification email goes to <b>{testRedirect}</b>.
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead title="Email me about" />
          <NotificationSettingsForm initial={{ assign_email: s.assign_email, urgent_email: s.urgent_email, digest_email: s.digest_email, digest_day: s.digest_day }} />
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Notification emails only ever go to teammates on the team list ({team().length} people), never to clients or contacts.
            You&apos;re never emailed about your own actions, the same event is never emailed twice, and nobody gets more than {DAILY_EMAIL_CAP} a day.
          </p>
        </section>

        <section className="space-y-8 lg:col-span-2">
          <div>
            <SectionHead title="Preview" />
            <div className="flex flex-wrap gap-2">
              {preview("assign", "Assignment email")}
              {preview("urgent", "Urgent email")}
              {preview("digest", "Weekly digest")}
            </div>
          </div>
          <div>
            <SectionHead title="Weekly digest" />
            <p className="mb-3 text-sm text-muted">Once deployed, it goes out automatically each person&apos;s chosen morning. Until then, send it from here.</p>
            <SendDigestNow testRedirect={testRedirect} />
          </div>
          <div>
            <SectionHead title="Scheduled sender" />
            <p className="text-sm text-muted">
              Automatic emails with nobody signed in (the digest, newly urgent tasks) are sent from one account.
              {senderReady ? <> Set up: <b className="text-ink">{process.env.NOTIFY_SENDER_EMAIL}</b>.</> : " Not set up yet."}
            </p>
            {!senderReady && !user?.demo && <SenderPermission />}
          </div>
        </section>
      </div>
    </>
  );
}
