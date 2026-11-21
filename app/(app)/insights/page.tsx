import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { RANGES, funnel, onboardingSpeed, rangeKey, retention } from "@/lib/insights";
import { journey } from "@/lib/journey";
import { params } from "@/lib/views";
import { Donut, FunnelBars, HBars, LineChart } from "@/components/charts";
import { PageHeader, SectionHead } from "@/components/ui";

/** One plain-language line under a chart. */
const Takeaway = ({ children }: { children: React.ReactNode }) => <p className="mt-4 text-sm text-ink">{children}</p>;
const NotEnough = ({ children }: { children: React.ReactNode }) => (
  <p className="border border-dashed border-line px-4 py-6 text-sm text-muted"><span className="font-medium text-ink">Not enough data yet.</span> {children}</p>
);
const Stat = ({ value, label, tone = "" }: { value: React.ReactNode; label: string; tone?: string }) => (
  <div><div className={`text-3xl font-medium tracking-tight tabular-nums ${tone}`}>{value}</div><div className="mt-1 text-xs text-muted">{label}</div></div>
);

// Insights: how well each stage converts, keeps and moves clients. Every number is computed from the data; no AI.
export default async function Insights({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const range = rangeKey(params(await searchParams).range);
  const data = await loadAll();
  const f = funnel(data, range);
  const r = retention(data, range);
  const o = onboardingSpeed(data, range);
  const label = RANGES.find((x) => x.key === range)!.label.toLowerCase();

  return (
    <>
      <PageHeader title="Insights" subtitle="How people move through outreach, how fast clients get set up, and how many stay.">
        <nav className="flex border border-line bg-white text-sm" aria-label="Date range">
          {RANGES.map((x) => (
            <Link key={x.key} href={`/insights?range=${x.key}`} aria-current={x.key === range ? "page" : undefined}
              className={`border-l border-line px-3 py-1.5 first:border-l-0 ${x.key === range ? "bg-forest font-medium text-white" : "text-muted hover:bg-surface hover:text-ink"}`}>
              {x.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {/* Outreach funnel */}
      <section id="outreach" className="scroll-mt-6">
        <SectionHead title="Outreach conversion" href="/board" linkText="Outreach board →" />
        <p className="-mt-2 mb-5 text-xs text-muted">Contacts added in the last {label}. A contact counts at every step up to the furthest stage they ever reached.</p>
        {f.enough ? (
          <div className="max-w-3xl">
            <div className="mb-2 grid grid-cols-[8.5rem_1fr_8.5rem] gap-3 text-[11px] uppercase tracking-[0.08em] text-faint">
              <span>Step</span><span>People</span><span className="text-right">kept · of start</span>
            </div>
            <FunnelBars steps={f.steps} color={journey("outreach").hex} />
            <Takeaway>{f.takeaway}</Takeaway>
          </div>
        ) : <NotEnough>The funnel needs at least 3 contacts added in this period. Try a longer range.</NotEnough>}
      </section>

      {/* Retention */}
      <section id="retention" className="mt-14 scroll-mt-6">
        <SectionHead title="Retention" href="/retention" linkText="Retention →" />
        {r.rate === null ? <NotEnough>No clients were active at the start of this period. Try a longer range.</NotEnough> : (
          <div className="grid gap-x-14 gap-y-10 lg:grid-cols-3">
            <div>
              <div className="flex gap-10">
                <Stat value={`${r.rate}%`} label={`retention rate (${r.still} of ${r.cohort})`} tone="text-retention-ink" />
                <Stat value={r.churned.length} label="churned" tone={r.churned.length ? "text-coral" : ""} />
              </div>
              <Takeaway>{r.takeaway}</Takeaway>
            </div>
            <div>
              <h3 className="label">Churn reasons</h3>
              {r.reasons.length
                ? <Donut data={r.reasons} caption={`${r.churned.length} churned`} />
                : <p className="text-sm text-muted">No one churned in this period.</p>}
            </div>
            <div>
              <h3 className="label">Retention rate by month</h3>
              {r.points.length >= 2 ? <><LineChart points={r.monthly} color={journey("retention").hex} /><p className="mt-2 text-sm text-ink">{r.lineTakeaway}</p></>
                : <p className="text-sm text-muted">Not enough data yet: needs at least two months with active clients.</p>}
            </div>
          </div>
        )}
      </section>

      {/* Onboarding speed */}
      <section id="onboarding" className="mt-14 scroll-mt-6">
        <SectionHead title="Onboarding speed" href="/onboarding" linkText="Onboarding board →" />
        {!o.enough ? <NotEnough>Average days per stage shows once a few clients have finished a stage. Try a longer range.</NotEnough> : (
          <div className="grid gap-x-14 gap-y-10 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h3 className="label">Average days in each stage</h3>
              <HBars color={journey("onboarding").hex} format={(v) => `${v} days`}
                rows={o.stages.map((s) => ({ label: s.label, value: s.avg, hint: `${s.n} client${s.n === 1 ? "" : "s"} measured` }))} />
              <Takeaway>{o.takeaway}</Takeaway>
            </div>
            <div className="space-y-8 lg:col-span-2">
              <Stat value={o.avgToFirstValue === null ? "—" : `${o.avgToFirstValue} days`} label="average time from handoff to first value" tone="text-onboarding-ink" />
              <div>
                <h3 className="label">Slower than average right now</h3>
                {o.stuck.length ? (
                  <ul className="divide-y divide-line border-y border-line text-sm">
                    {o.stuck.map((s) => (
                      <li key={s.c.id}>
                        <Link href={`/onboarding/${s.c.id}`} className="flex items-baseline justify-between gap-3 py-2 hover:bg-surface">
                          <span><span className="font-medium text-ink">{s.c.name}</span> <span className="text-muted">· {s.stage.label}</span></span>
                          <span className="shrink-0 text-xs tabular-nums text-coral">{s.days} days (avg {s.avg})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">Nobody is stuck. Everyone is at or under the average for their stage.</p>}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
