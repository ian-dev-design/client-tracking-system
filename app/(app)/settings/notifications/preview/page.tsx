import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { buildDigest } from "@/lib/digest";
import { sampleEmail } from "@/lib/notify";
import { team } from "@/lib/team";
import { params } from "@/lib/views";
import { PageHeader } from "@/components/ui";

const TITLES: Record<string, string> = { assign: "Assignment email", urgent: "Urgent email", digest: "Weekly digest" };

// Shows an email exactly as a teammate would get it. Nothing is sent from this page.
export default async function EmailPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const type = TITLES[f.type] ? f.type : "assign";
  const user = await currentUser();
  const mates = team();
  // Default: preview what a teammate other than you would receive.
  const mate = mates.find((m) => m.email === f.who) || mates.find((m) => m.email !== user?.email) || mates[0]
    || { name: user?.name || "You", email: user?.email || "" };
  const by = user?.name || "Someone";
  const testRedirect = process.env.EMAIL_TEST_REDIRECT?.trim();

  let subject = "", body = "", note = "";
  if (type === "digest") {
    const d = await buildDigest(mate);
    subject = d.subject; body = d.body;
    if (d.empty) note = `${mate.name} has nothing to report this week, so no digest email would be sent.`;
  } else {
    ({ subject, body } = await sampleEmail(type as "assign" | "urgent", mate, by));
  }

  const tab = (t: string) => (
    <Link key={t} href={`/settings/notifications/preview?type=${t}&who=${encodeURIComponent(mate.email)}`}
      className={`-mb-px border-b-2 py-2 text-sm ${t === type ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{TITLES[t]}</Link>
  );

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/settings/notifications" className="text-muted hover:underline">← Notifications</Link></div>
      <PageHeader title="Email preview" subtitle="Exactly what a teammate would receive. Nothing is sent from this page." />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <div className="flex gap-6">{Object.keys(TITLES).map(tab)}</div>
        <div className="flex gap-3 pb-2 text-sm">
          <span className="text-muted">Recipient:</span>
          {mates.map((m) => (
            <Link key={m.email} href={`/settings/notifications/preview?type=${type}&who=${encodeURIComponent(m.email)}`}
              className={m.email === mate.email ? "font-semibold text-ink" : "text-muted hover:text-ink"}>{m.name}</Link>
          ))}
        </div>
      </div>

      {note && <div className="mb-4 border-l-[3px] border-line bg-surface px-4 py-2.5 text-sm text-muted">{note}</div>}
      <article className="max-w-2xl border border-line bg-white">
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1 border-b border-line px-5 py-4 text-sm">
          <dt className="text-muted">From</dt><dd>{type === "digest" ? "The scheduled sender (or you, with Send now)" : `${by} (your Gmail)`}</dd>
          <dt className="text-muted">To</dt><dd>{mate.name} &lt;{mate.email}&gt;{testRedirect && <span className="text-muted"> · test mode: delivered to {testRedirect}</span>}</dd>
          <dt className="text-muted">Subject</dt><dd className="font-semibold">{testRedirect ? `[TEST → ${mate.email}] ` : ""}{subject}</dd>
        </dl>
        <pre className="whitespace-pre-wrap px-5 py-5 font-sans text-sm leading-relaxed text-ink">{body}</pre>
      </article>
    </>
  );
}
