import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { dashboardData } from "@/lib/dashboard";
import { JOURNEY, journey } from "@/lib/journey";
import { moneyShort } from "@/lib/target";
import { Donut, StackedBar } from "@/components/charts";
import { ContactActions } from "@/components/ContactActions";
import { PersonCard } from "@/components/PersonCard";
import { SyncNowButton } from "@/components/SurveySync";
import { PageHeader, SectionHead } from "@/components/ui";

// Home base: a quick visual read of everything, what needs attention, and a link into every tab.
export default async function Dashboard() {
  const d = dashboardData(await loadAll());
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const testRedirect = process.env.EMAIL_TEST_REDIRECT;
  const attention = d.needsAttention.slice(0, 8);
  const perRow = Math.ceil(attention.length / Math.ceil(attention.length / 4)) || 1; // at most 4 per row, rows as even as possible
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

      {/* Needs attention */}
      <section className="mt-12">
        <SectionHead title="Needs attention" href="/tasks" linkText="My tasks →" />
        {d.needsAttention.length ? (
          // Balanced rows (5 cards → 3 + 2, 6 → 3 + 3); cards in a row stretch to fill it and match heights.
          <div className="flex flex-wrap gap-3">
            {attention.map(({ c, stage, reasons }) => (
              <div key={c.id} className="min-w-[240px]" style={{ flex: `1 1 calc(${100 / perRow}% - 0.75rem)` }}>
              <PersonCard name={c.name} company={c.company} href={`/contacts/${c.id}`}
                accent={stage ? journey(stage).border : "border-l-line"}
                meta={<span key="meta">{c.stage || c.research_status}</span>}
                tags={reasons}
                footer={
                  <div key="footer" className="mt-3 border-t border-line pt-3">
                    <ContactActions contact={c} size="sm" show={["draft", "log", "view"]} testRedirect={testRedirect} />
                  </div>
                }
              />
              </div>
            ))}
          </div>
        ) : <p className="muted">Nothing needs attention right now.</p>}
        {d.needsAttention.length > 8 && <Link href="/tasks" className="link mt-3 inline-block text-sm">{d.needsAttention.length - 8} more →</Link>}
      </section>

      {/* Journey row: a door into each stage */}
      <section className="mt-14">
        <SectionHead title="Journey" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {JOURNEY.map((j) => {
            const people = d.journeyPeople[j.key];
            return (
              <div key={j.key} className={`flex flex-col border border-l-[3px] border-line bg-white p-4 ${j.border}`}>
                <div className="eyebrow">Step {j.n}</div>
                <div className="mt-1 text-lg font-bold tracking-tight">{j.label}</div>
                <div className="text-xs text-muted">{j.purpose}</div>
                <ul className="mt-4 flex-1 space-y-1 text-sm">
                  {people.slice(0, 3).map((c) => (
                    <li key={c.id}><Link href={`/contacts/${c.id}`} className="hover:underline">{c.name}</Link></li>
                  ))}
                  {!people.length && <li className="text-faint">No one here yet</li>}
                  {people.length > 3 && <li className="text-xs text-muted">and {people.length - 3} more</li>}
                </ul>
                <Link href={j.href} className="mt-4 text-sm font-medium text-forest hover:underline">Open →</Link>
              </div>
            );
          })}
        </div>
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
