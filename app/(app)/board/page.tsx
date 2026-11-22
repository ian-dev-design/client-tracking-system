import Link from "next/link";
import { loadAll, isProspect } from "@/lib/crm";
import { BOARD_STAGES } from "@/lib/data";
import { boardCard, filterContacts, owners, params } from "@/lib/views";
import { Board } from "@/components/Board";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader } from "@/components/ui";

export default async function OutreachBoard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const data = await loadAll();
  const { contacts, interactions, interviews, drafts, tasks } = data;
  const prospects = contacts.filter(isProspect).filter((c) => (BOARD_STAGES as readonly string[]).includes(c.stage));
  const cards = filterContacts(prospects, f).map((c) => boardCard(c, interactions, interviews, drafts, "stage", tasks));
  return (
    <>
      <PageHeader title="Outreach" stage="outreach">
        <Link href="/contacts/new" className="btn btn-primary">+ Add contact</Link>
      </PageHeader>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["type", "owner"] : ["type"]} />
      {/* key forces a fresh board when filters or data change */}
      <Board key={JSON.stringify(cards)} stages={[...BOARD_STAGES]} field="stage" track="outreach"
        initial={cards} showOwner={owners(contacts).length > 1} testRedirect={process.env.EMAIL_TEST_REDIRECT} />
    </>
  );
}
