import { loadAll } from "@/lib/crm";
import { onboardingSpeed } from "@/lib/insights";
import { ONBOARDING_STAGES, onboardingView } from "@/lib/onboarding";
import { amount } from "@/lib/target";
import { filterContacts, owners, params } from "@/lib/views";
import { HBars } from "@/components/charts";
import { FilterBar } from "@/components/FilterBar";
import { InsightStrip } from "@/components/InsightStrip";
import { OnboardingBoard } from "@/components/OnboardingBoard";
import { PageHeader } from "@/components/ui";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const data = await loadAll();
  const { contacts, onboarding } = data;
  const cards = filterContacts(contacts.filter((c) => c.stage === "Onboarding"), f)
    .map((c) => onboardingView(onboarding.find((o) => o.contact_id === c.id), c, amount(c.deal_value)));
  const speed = onboardingSpeed(data, "all");

  return (
    <>
      <PageHeader title="Onboarding" stage="onboarding" />
      <InsightStrip href="/insights#onboarding" summary={speed.enough
        ? <>Average days per stage{speed.avgToFirstValue !== null && <> · first value in <b>{speed.avgToFirstValue} days</b></>}{speed.stuck.length ? <> · <span className="font-medium text-coral">{speed.stuck.length} slower than average</span></> : null}</>
        : <span className="text-muted">Onboarding speed: not enough finished stages yet.</span>}>
        {speed.enough
          ? <HBars mini color="#d69a2d" rows={speed.stages.map((s) => ({ label: s.label, value: s.avg }))} format={(v) => `${v}d`} />
          : <p className="muted">Average days per stage shows here once a few clients have moved through a stage.</p>}
      </InsightStrip>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["owner"] : []} />
      <OnboardingBoard key={JSON.stringify(cards)} stages={ONBOARDING_STAGES.map(({ key, label, description }) => ({ key, label, description }))} initial={cards} />
    </>
  );
}
