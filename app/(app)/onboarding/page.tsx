import { loadAll } from "@/lib/crm";
import { onboardingSpeed } from "@/lib/insights";
import { ONBOARDING_STAGES, onboardingView } from "@/lib/onboarding";
import { amount } from "@/lib/target";
import { onboardingUrgency } from "@/lib/urgency";
import { filterContacts, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
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
  // (Charts for this stage live on the Insights page; speed is used here only for the "Stuck" flag.)

  return (
    <>
      <PageHeader title="Onboarding" stage="onboarding" />
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["owner"] : []} />
      <OnboardingBoard key={JSON.stringify(cards)} stages={ONBOARDING_STAGES.map(({ key, label, description }) => ({ key, label, description }))} initial={cards} />
    </>
  );
}
