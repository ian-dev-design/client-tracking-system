import { isResearch, loadAll } from "@/lib/crm";
import { RESEARCH_STATUSES } from "@/lib/data";
import { boardCard, filterContacts, owners, params } from "@/lib/views";
import { Board } from "@/components/Board";
import { FilterBar } from "@/components/FilterBar";

export default async function ResearchBoard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { contacts, interactions, interviews, drafts } = await loadAll();
  const people = contacts.filter((c) => isResearch(c) && c.research_status);
  const cards = filterContacts(people, f).map((c) => boardCard(c, interactions, interviews, drafts, "research_status"));
  return (
    <>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["type", "owner"] : ["type"]} />
      <Board key={JSON.stringify(cards)} stages={[...RESEARCH_STATUSES]} field="research_status" track="research"
        initial={cards} showOwner={owners(contacts).length > 1} testRedirect={process.env.EMAIL_TEST_REDIRECT} />
    </>
  );
}
