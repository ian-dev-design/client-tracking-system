import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { dashboardData } from "@/lib/dashboard";
import { JOURNEY, journey } from "@/lib/journey";
import { moneyShort } from "@/lib/target";
import { Donut, StackedBar } from "@/components/charts";
import { SyncNowButton } from "@/components/SurveySync";
import { PageHeader, SectionHead } from "@/components/ui";

// Urgency dot, standard traffic colors: red glows when overdue (faster once a week+ late),
// yellow = due today / worth a look, pale yellow = ready for the next step, no rush.
const URGENCY = {
  critical: "text-urgent motion-safe:animate-glow-fast",
  alert: "text-urgent motion-safe:animate-glow",
  due: "text-warn",
  ready: "text-warn-soft",
} as const;
const URGENCY_LABEL = { critical: "Overdue a week or more", alert: "Overdue", due: "Due", ready: "Ready" } as const;

// Home base: a quick visual read of everything, what needs attention, and a link into every tab.
export default async function Dashboard() {
  const d = dashboardData(await loadAll());
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const attention = d.needsAttention.slice(0, 8);
  // ", healthy" / ", 1 needs attention" / ", 1 at risk"
  const onboardingHealth = !d.onboardingCount ? "" : [
    d.health.red && `${d.health.red} at risk`,
    d.health.yellow && `${d.health.yellow} needs attention`,
  ].filter(Boolean).join(", ").replace(/^(.+)$/, ", $1") || ", healthy";

  return (
    <>
      <PageHeader title="Dashboard" subtitle={todayLabel}>
        <SyncNowButton />
      </PageHeader>

      {/* Two visuals: the journey (hero) and the money */}
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
        <section>
          <SectionHead title="Journey split" href="/contacts" linkText="All contacts →" />
          <Donut data={d.journeySplit} caption={`${d.total} people`} size="lg" />
        </section>
        <section>
          <SectionHead title="Pipeline value" href="/board" linkText="Outreach →" />
          <div className="text-5xl font-bold tracking-[-0.03em] tabular-nums">{moneyShort(d.pipelineTotal)} <span className="text-2xl font-semibold text-muted">open</span></div>
          <div className="mt-1 text-sm text-muted">{moneyShort(d.wonTotal)} won</div>
          <div className="mt-8"><StackedBar data={d.pipeline} format={moneyShort} /></div>
        </section>
      </div>

      {/* Slim stat line */}
      <p className="mt-10 flex flex-wrap gap-x-3 gap-y-1 border-y border-line py-3 text-sm text-muted">
        <Link href="/research/participants" className="hover:text-ink hover:underline">
          <span className="font-semibold text-ink">{d.respondedCount} of {d.reachedCount}</span> surveys back
        </Link>
        <span aria-hidden>·</span>
        <Link href="/onboarding" className="hover:text-ink hover:underline">
          <span className="font-semibold text-ink">{d.onboardingCount}</span> onboarding{onboardingHealth}
        </Link>
      </p>

      {/* Journey: one word per stage, each a door into that stage */}
      <nav aria-label="Journey" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {JOURNEY.map((j) => {
          const n = d.journeyPeople[j.key].length;
          return (
            <Link key={j.key} href={j.href}
              className={`group border border-l-[3px] border-line bg-white px-4 py-3 transition-colors hover:bg-surface ${j.border}`}>
              <div className="flex items-center justify-between text-sm font-semibold text-ink">
                {j.label}
                <span className="text-faint group-hover:text-ink" aria-hidden>→</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums tracking-tight">{n}</span>
                <span className="text-sm text-muted">{n === 1 ? "person" : "people"}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Needs attention: name + what to do in two words; the dot shows urgency */}
      <section className="mt-12">
        <SectionHead title={`Needs attention (${d.needsAttention.length})`} href="/tasks" linkText="My tasks →" />
        {attention.length ? (
          <ul className="grid gap-x-8 border-t border-line md:grid-cols-2">
            {attention.map(({ c, reasons }) => {
              const top = reasons[0];
              return (
                <li key={c.id} className="border-b border-line">
                  <Link href={`/contacts/${c.id}`} title={reasons.map((r) => r.detail).join("\n")}
                    className="group flex items-center gap-3 px-1 py-2.5 text-sm transition-colors hover:bg-surface">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${URGENCY[top.tone]}`}
                      role="img" aria-label={URGENCY_LABEL[top.tone]} title={URGENCY_LABEL[top.tone]} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{c.name}</span>
                    <span className="shrink-0 text-muted">
                      {top.label}{reasons.length > 1 && <span className="text-faint"> +{reasons.length - 1}</span>}
                    </span>
                    <span className="text-faint group-hover:text-ink" aria-hidden>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted">Nothing needs attention right now.</p>}
        {d.needsAttention.length > 8 && <Link href="/tasks" className="link mt-3 inline-block text-sm">{d.needsAttention.length - 8} more →</Link>}
      </section>

      {/* Themes + recent activity */}
      <div className="mt-14 grid gap-10 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead title="Top research themes" href="/research/themes" linkText="All themes →" />
          {d.topThemes.length ? (
            <div className="space-y-3">
              {d.topThemes.map((t) => (
                <Link key={t.theme} href={`/research/library?theme=${encodeURIComponent(t.theme)}`}
                  className="block border border-l-[3px] border-line border-l-sage bg-white p-4 transition-colors hover:bg-surface">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{t.theme}</span>
                    <span className="text-xs text-muted">{t.count} interview{t.count === 1 ? "" : "s"}</span>
                  </div>
                  {t.quote && <p className="mt-1.5 text-sm text-muted">&ldquo;{t.quote}&rdquo;</p>}
                </Link>
              ))}
            </div>
          ) : <p className="muted">Run /research-synthesis in Claude Code to build themes.</p>}
        </section>

        <section className="lg:col-span-2">
          <SectionHead title="Recent activity" href="/tasks" linkText="My tasks →" />
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
          ) : <p className="muted">No activity yet.</p>}
        </section>
      </div>
    </>
  );
}
