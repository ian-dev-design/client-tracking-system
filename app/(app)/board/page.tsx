import Link from "next/link";
import { loadAll, isProspect } from "@/lib/crm";
import { BOARD_STAGES } from "@/lib/data";
import { boardCard, filterContacts, owners, params } from "@/lib/views";
import { Board } from "@/components/Board";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader } from "@/components/ui";
import { FunnelBars } from "@/components/charts";
import { InsightStrip } from "@/components/InsightStrip";
import { funnel } from "@/lib/insights";
import { journey } from "@/lib/journey";

export default async function OutreachBoard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const data = await loadAll();
  const { contacts, interactions, interviews, drafts, tasks } = data;
  const fun = funnel(data, "all");
  const prospects = contacts.filter(isProspect).filter((c) => (BOARD_STAGES as readonly string[]).includes(c.stage));
  const cards = filterContacts(prospects, f).map((c) => boardCard(c, interactions, interviews, drafts, "stage", tasks));
  return (
    <>
      <PageHeader title="Outreach" stage="outreach">
        <Link href="/contacts/new" className="btn btn-primary">+ Add contact</Link>
      </PageHeader>
      <InsightStrip href="/insights#outreach" summary={fun.enough
        ? <>Of <b>{fun.total}</b> contacted, <b>{fun.steps[1].pctStart}%</b> responded and <b>{fun.steps[3].pctStart}%</b> reached onboarding{fun.dropLabel && <> · biggest drop: <b>{fun.dropLabel}</b></>}</>
        : <span className="text-muted">Conversion: not enough contacts yet.</span>}>
        {fun.enough ? <FunnelBars mini steps={fun.steps} color={journey("outreach").hex} /> : <p className="muted">The mini funnel shows once you have a few contacts.</p>}
      </InsightStrip>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["type", "owner"] : ["type"]} />
      {/* key forces a fresh board when filters or data change */}
      <Board key={JSON.stringify(cards)} stages={[...BOARD_STAGES]} field="stage" track="outreach"
        initial={cards} showOwner={owners(contacts).length > 1} testRedirect={process.env.EMAIL_TEST_REDIRECT} />
    </>
  );
}
