import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { dashboardData } from "@/lib/dashboard";
import { JOURNEY, journey } from "@/lib/journey";
import { moneyShort } from "@/lib/target";
import { actionFor, readyForInterview } from "@/lib/views";
import { Donut, StackedBar } from "@/components/charts";
import { FollowupCard } from "@/components/FollowupCard";
import { SyncNowButton } from "@/components/SurveySync";
import { SectionHead } from "@/components/ui";

// Urgency dot, standard traffic colors: red glows when overdue (faster once a week+ late),
// yellow = due today / worth a look, pale yellow = ready for the next step, no rush.
const URGENCY = {
  critical: "text-urgent motion-safe:animate-glow-fast",
  alert: "text-urgent motion-safe:animate-glow",
  due: "text-warn",
  ready: "text-warn-soft",
} as const;
const URGENCY_LABEL = { critical: "Overdue a week or more", alert: "Overdue", due: "Due", ready: "Ready" } as const;

// Home base: what needs you first, then where everyone is, then the money, then research and activity.
export default async function Dashboard() {
  const data = await loadAll();
  const d = dashboardData(data);
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const attention = d.needsAttention.slice(0, 6);
  const onboardingHealth = !d.onboardingCount ? "" : [
    d.health.red && `${d.health.red} at risk`,
    d.health.yellow && `${d.health.yellow} needs attention`,
  ].filter(Boolean).join(", ").replace(/^(.+)$/, ", $1") || ", healthy";
  const pipeline = d.pipeline.filter((p) => p.value > 0); // no $0 stages

  return (
    <>
      {/* No big title: a small date label and the one page-level action */}
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-4">
        <p className="text-sm text-muted">{todayLabel}</p>
        <SyncNowButton />
      </div>

      {/* 1. Needs attention: whole row opens the profile; one next step per person, most urgent first */}
      <section>
        <SectionHead title={`Needs attention (${d.needsAttention.length})`} href="/tasks" linkText="My tasks →" />
        {attention.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {attention.map(({ c, stage, reasons }) => {
              const top = reasons[0];
              return (
                <FollowupCard key={c.id} contact={c} company={c.company}
                  reason={top.detail + (reasons.length > 1 ? ` · +${reasons.length - 1} more` : "")}
                  overdue={top.tone === "critical" || top.tone === "alert"}
                  accent={stage ? journey(stage).border : "border-l-line"}
                  action={actionFor(c, readyForInterview(c, data.interviews))} testRedirect={process.env.EMAIL_TEST_REDIRECT}
                  urgency={<span key="dot" className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${URGENCY[top.tone]}`} role="img"
                    aria-label={URGENCY_LABEL[top.tone]} title={URGENCY_LABEL[top.tone]} />} />
              );
            })}
          </div>
        ) : <p className="muted">Nothing needs attention right now. <Link href="/contacts/new" className="link">+ Add a contact</Link></p>}
        {d.needsAttention.length > attention.length && (
          <Link href="/tasks" className="link mt-3 inline-block text-sm">{d.needsAttention.length - attention.length} more →</Link>
        )}
      </section>

      <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-2">
        {/* 2. Journey: the donut and the four stages as one block of navigation */}
        <section>
          <SectionHead title="Journey" href="/contacts" linkText="All contacts →" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Donut data={d.journeySplit} caption={`${d.total} people`} showLegend={false} />
            <ul className="min-w-0 flex-1 divide-y divide-line border-y border-line">
              {JOURNEY.map((j) => {
                const people = d.journeyPeople[j.key];
                return (
                  <li key={j.key} className={`border-l-[3px] ${j.border}`}>
                    <div className="flex items-baseline justify-between gap-3 px-3 pt-2">
                      <Link href={j.href} className="text-sm font-semibold text-ink hover:underline">{j.label}</Link>
                      <span className="text-sm tabular-nums text-muted">{people.length}</span>
                    </div>
                    <div className="truncate px-3 pb-2 text-xs text-muted">
                      {people.length ? people.slice(0, 3).map((c, i) => (
                        <span key={c.id}>{i > 0 && ", "}<Link href={`/contacts/${c.id}`} className="hover:text-ink hover:underline">{c.name}</Link></span>
                      )) : <span className="text-faint">No one here yet</span>}
                      {people.length > 3 && <span className="text-faint"> +{people.length - 3}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-4 flex flex-wrap gap-x-3 text-sm text-muted">
            <Link href="/research/participants" className="hover:text-ink hover:underline">
              <span className="font-semibold text-ink">{d.respondedCount} of {d.reachedCount}</span> surveys back
            </Link>
            <span aria-hidden>·</span>
            <Link href="/onboarding" className="hover:text-ink hover:underline">
              <span className="font-semibold text-ink">{d.onboardingCount}</span> onboarding{onboardingHealth}
            </Link>
          </p>
        </section>

        {/* 3. Pipeline: one line and one thin bar */}
        <section>
          <SectionHead title="Pipeline" href="/board" linkText="Outreach →" />
          <p className="text-2xl font-medium tracking-tight tabular-nums">
            {moneyShort(d.pipelineTotal)} <span className="text-base font-normal text-muted">open</span>
            <span className="mx-2 text-faint">·</span>
            {moneyShort(d.wonTotal)} <span className="text-base font-normal text-muted">won</span>
          </p>
          <div className="mt-5">
            {pipeline.length ? <StackedBar data={pipeline} format={moneyShort} />
              : <p className="muted">No deal values yet. Add one from a contact&apos;s <b>Edit deal</b>.</p>}
          </div>
        </section>
      </div>

      {/* 4. Research themes + recent activity */}
      <div className="mt-14 grid gap-10 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead title="Top research themes" href="/research/themes" linkText="All themes →" />
          {d.topThemes.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {d.topThemes.map((t) => (
                <li key={t.theme}>
                  <Link href={`/research/library?theme=${encodeURIComponent(t.theme)}`} className="block px-1 py-3 transition-colors hover:bg-surface">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold">{t.theme}</span>
                      <span className="text-xs text-muted">{t.count} interview{t.count === 1 ? "" : "s"}</span>
                    </div>
                    {t.quote && <p className="mt-1 text-sm text-muted">&ldquo;{t.quote}&rdquo;</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No themes yet. Run /research-synthesis in Claude Code to build them from your interviews.</p>}
        </section>

        <section className="lg:col-span-2">
          <SectionHead title="Recent activity" />
          {d.recent.length ? (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {d.recent.map((r) => (
                <li key={r.id} className="relative">
                  <span className={`absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full ring-2 ring-paper ${r.stage ? journey(r.stage).bg : "bg-faint"}`} aria-hidden />
                  <Link href={`/contacts/${r.contactId}`} className="text-sm text-ink hover:underline">{r.text}</Link>
                  <div className="text-xs text-faint">{r.when}</div>
                </li>
              ))}
            </ol>
          ) : <p className="muted">No activity yet. Log a call or send outreach and it shows up here.</p>}
        </section>
      </div>
    </>
  );
}
