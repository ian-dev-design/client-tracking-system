import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { byId, onboardingView, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { OnboardingCard, type OnboardingView } from "@/components/OnboardingCard";
import { Empty, PageHeader } from "@/components/ui";

const HEALTH_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2 };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { onboarding, contacts } = await loadAll();
  const people = byId(contacts);
  const q = (f.q || "").toLowerCase();
  const items: OnboardingView[] = onboarding
    .map((o) => onboardingView(o, people.get(o.contact_id)))
    .filter((i) => i.stage === "Onboarding")
    .filter((i) => (!f.owner || i.owner === f.owner) && (!q || `${i.name} ${i.company}`.toLowerCase().includes(q)))
    // Needs most attention first: worst health, then blockers, then least progress.
    .sort((a, b) => (HEALTH_RANK[a.health] ?? 2) - (HEALTH_RANK[b.health] ?? 2)
      || Number(!!b.blockers) - Number(!!a.blockers) || a.progress - b.progress);

  return (
    <>
      <PageHeader title="Onboarding" stage="onboarding" subtitle="Get each new client through the onboarding checklist. Neediest first; click a step to check it off." />
      <FilterBar owners={owners(contacts)} show={["owner"]} />
      {items.length
        ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <OnboardingCard key={i.id} item={i} />)}</div>
        : <Empty>No one is onboarding yet. Move a qualified client here from the Outreach board.
          <Link href="/board" className="btn btn-sm ml-2">Open Outreach board</Link></Empty>}
    </>
  );
}
