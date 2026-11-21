import { loadAll } from "@/lib/crm";
import { onboardingSpeed } from "@/lib/insights";
import { ONBOARDING_STAGES, onboardingView } from "@/lib/onboarding";
import { amount } from "@/lib/target";
import { onboardingUrgency } from "@/lib/urgency";
import { filterContacts, owners, params } from "@/lib/views";
import { HBars } from "@/components/charts";
import { journey } from "@/lib/journey";
import { FilterBar } from "@/components/FilterBar";
import { InsightStrip } from "@/components/InsightStrip";
import { OnboardingBoard } from "@/components/OnboardingBoard";
import { PageHeader } from "@/components/ui";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const data = await loadAll();
  const { contacts, onboarding, tasks } = data;
  const speed = onboardingSpeed(data, "all");
  const stuck = new Map(speed.stuck.map((s) => [s.c.id, { days: s.days, stage: s.stage.label }]));
  const inOnboarding = contacts.filter((c) => c.stage === "Onboarding");
  const cards = filterContacts(inOnboarding, f).map((c) => {
    const row = onboarding.find((o) => o.contact_id === c.id);
    return { ...onboardingView(row, c, amount(c.deal_value)), urgency: onboardingUrgency(c, row, tasks, stuck.get(c.id) || null) };
  });
  // Clients per stage for the strip (everyone in onboarding, before filters).
  const all = inOnboarding.map((c) => onboardingView(onboarding.find((o) => o.contact_id === c.id), c));
  const perStage = ONBOARDING_STAGES.map((s) => ({ label: s.label, value: all.filter((v) => v.stageKey === s.key).length }));

  return (
    <>
      <PageHeader title="Onboarding" stage="onboarding" />
      <InsightStrip href="/insights#onboarding" summary={<>
        <b>{all.length}</b> client{all.length === 1 ? "" : "s"} onboarding
        {speed.avgToFirstValue !== null && <> · first value in <b>{speed.avgToFirstValue} days</b> on average</>}
        {speed.stuck.length ? <> · <span className="font-medium text-amber-ink">{speed.stuck.length} stuck</span></> : null}
      </>}>
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          <div>
            <div className="label">Clients per stage</div>
            <HBars mini color={journey("onboarding").hex} rows={perStage} />
          </div>
          <div>
            <div className="label">Average days per stage</div>
            {speed.enough
              ? <HBars mini color={journey("onboarding").hex} rows={speed.stages.map((s) => ({ label: s.label, value: s.avg }))} format={(v) => `${v}d`} />
              : <p className="text-xs text-muted">Not enough data yet: shows once a few clients have finished a stage.</p>}
          </div>
        </div>
      </InsightStrip>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["owner"] : []} />
      <OnboardingBoard key={JSON.stringify(cards)} stages={ONBOARDING_STAGES.map(({ key, label, description }) => ({ key, label, description }))} initial={cards} />
    </>
  );
}
