import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { dashboardData } from "@/lib/dashboard";
import { RANGES, funnel, healthSplit, onboardingSpeed, rangeKey, retention } from "@/lib/insights";
import { journey } from "@/lib/journey";
import { params } from "@/lib/views";
import { Donut, FunnelBars, HBars, LineChart, MonthBars } from "@/components/charts";
import { PageHeader } from "@/components/ui";

/**
 * One chart per card: a clear title, the chart, one computed takeaway line, and room to breathe.
 * `note` says what the card covers (the period, or "right now").
 */
function Card({ id, title, note, href, linkText, takeaway, className = "", children }: {
  id?: string; title: string; note?: string; href?: string; linkText?: string; takeaway?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-6 border border-line bg-white p-6 sm:p-8 ${className}`}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
        </div>
        {href && <Link href={href} className="text-xs font-medium text-info hover:underline">{linkText}</Link>}
      </div>
      {children}
      {takeaway && <p className="mt-6 border-t border-line pt-4 text-sm text-ink">{takeaway}</p>}
    </section>
  );
}
const NotEnough = ({ children }: { children: React.ReactNode }) => (
  <p className="border border-dashed border-line px-4 py-8 text-sm text-muted"><span className="font-medium text-ink">Not enough data yet.</span> {children}</p>
);
const Stat = ({ value, label, tone = "" }: { value: React.ReactNode; label: string; tone?: string }) => (
  <div><div className={`text-4xl font-medium tracking-tight tabular-nums ${tone}`}>{value}</div><div className="mt-1 text-xs text-muted">{label}</div></div>
);

// Insights: the one place for charts. Every number is computed from the data; no AI.
export default async function Insights({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const range = rangeKey(params(await searchParams).range);
  const data = await loadAll();
  const f = funnel(data, range);
  const r = retention(data, range);
  const o = onboardingSpeed(data, range);
  const split = dashboardData(data).journeySplit;
  const health = healthSplit(data);
  const label = RANGES.find((x) => x.key === range)!.label.toLowerCase();
  const period = range === "all" ? "All time" : `Last ${label}`;

  // Snapshot takeaways (who is where right now).
  const total = split.reduce((a, s) => a + s.value, 0);
  const biggest = split.reduce((a, b) => (b.value > a.value ? b : a), split[0]);
  const clients = health.reduce((a, s) => a + s.value, 0);
  const atRisk = health.find((h) => h.label === "At risk")?.value || 0;
  const healthy = health.find((h) => h.label === "Healthy")?.value || 0;

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

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 1. Outreach conversion (full width) */}
        <Card id="outreach" className="lg:col-span-2" title="Outreach conversion" href="/board" linkText="Outreach board →"
          note={`${period}: people first contacted in this period. Someone counts at every step up to the furthest one they reached.`}
          takeaway={f.enough ? f.takeaway : undefined}>
          {f.enough ? (
            <div className="max-w-4xl">
              <div className="mb-3 grid grid-cols-[8.5rem_1fr_8.5rem] gap-3 text-[11px] uppercase tracking-[0.08em] text-faint">
                <span>Step</span><span>People</span><span className="text-right">kept · of start</span>
              </div>
              <FunnelBars steps={f.steps} color={journey("outreach").hex} />
            </div>
          ) : <NotEnough>The funnel needs at least 3 people contacted in this period. Try a longer range.</NotEnough>}
        </Card>

        {/* 2. Retention rate by month */}
        <Card id="retention" title="Retention rate" href="/retention" linkText="Retention →"
          note={`${period}: clients active at the start who are still active.`}
          takeaway={r.rate === null ? undefined : <>{r.takeaway}{r.lineTakeaway && <> {r.lineTakeaway}</>}</>}>
          {r.rate === null ? <NotEnough>No clients were active at the start of this period. Try a longer range.</NotEnough> : (
            <>
              <Stat value={`${r.rate}%`} label={`retention rate (${r.still} of ${r.cohort})`} tone="text-retention-ink" />
              <div className="mt-8">
                <div className="label">By month</div>
                {r.points.length >= 2 ? <LineChart points={r.monthly} color={journey("retention").hex} />
                  : <p className="text-sm text-muted">Needs at least two months with active clients.</p>}
              </div>
            </>
          )}
        </Card>

        {/* 3. Churn over time + reasons */}
        <Card title="Churn" note={`${period}: clients who left, by month and by reason.`} href="/retention?tab=renewals" linkText="Renewals →"
          takeaway={r.churnTakeaway}>
          <Stat value={r.churned.length} label="churned" tone={r.churned.length ? "text-coral" : ""} />
          <div className="mt-8">
            <div className="label">Per month</div>
            <MonthBars months={r.monthly} color="#b84a2c" />
          </div>
          <div className="mt-8">
            <div className="label">Reasons</div>
            {r.reasons.length ? <Donut data={r.reasons} caption={`${r.churned.length} churned`} />
              : <p className="text-sm text-muted">No one churned in this period.</p>}
          </div>
        </Card>

        {/* 4. Onboarding speed */}
        <Card id="onboarding" className="lg:col-span-2" title="Onboarding speed" href="/onboarding" linkText="Onboarding board →"
          note={`${period}: clients who started onboarding in this period.`} takeaway={o.enough ? o.takeaway : undefined}>
          {!o.enough ? <NotEnough>Average days per stage shows once a few clients have finished a stage. Try a longer range.</NotEnough> : (
            <div className="grid gap-x-14 gap-y-10 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="label">Average days in each stage</div>
                <HBars color={journey("onboarding").hex} format={(v) => `${v} days`}
                  rows={o.stages.map((s) => ({ label: s.label, value: s.avg, hint: `${s.n} client${s.n === 1 ? "" : "s"} measured` }))} />
              </div>
              <div className="space-y-8 lg:col-span-2">
                <Stat value={o.avgToFirstValue === null ? "—" : `${o.avgToFirstValue} days`} label="average from handoff to first value" tone="text-onboarding-ink" />
                <div>
                  <div className="label">Slower than average right now</div>
                  {o.stuck.length ? (
                    <ul className="divide-y divide-line border-y border-line text-sm">
                      {o.stuck.map((s) => (
                        <li key={s.c.id}>
                          <Link href={`/onboarding/${s.c.id}`} className="flex items-baseline justify-between gap-3 py-2 hover:bg-surface">
                            <span><span className="font-medium text-ink">{s.c.name}</span> <span className="text-muted">· {s.stage.label}</span></span>
                            <span className="shrink-0 text-xs tabular-nums text-amber-ink">{s.days} days (avg {s.avg})</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">Nobody is stuck right now.</p>}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 5. Clients per stage (right now) */}
        <Card id="clients" title="People per stage" note="Right now: everyone, in the stage they're furthest along." href="/contacts" linkText="All contacts →"
          takeaway={total ? `${total} people in all; the most are in ${biggest.label} (${biggest.value}).` : undefined}>
          {total ? <Donut data={split} caption={`${total} people`} /> : <NotEnough>Add a few contacts to see this.</NotEnough>}
        </Card>

        {/* 6. Health distribution (right now) */}
        <Card title="Client health" note="Right now: active clients, calculated (or set by hand)." href="/retention" linkText="Health board →"
          takeaway={clients ? `${healthy} of ${clients} clients are healthy${atRisk ? `; ${atRisk} at risk` : ""}.` : undefined}>
          {clients ? <Donut data={health} caption={`${clients} clients`} /> : <NotEnough>No active clients yet.</NotEnough>}
        </Card>
      </div>
    </>
  );
}
