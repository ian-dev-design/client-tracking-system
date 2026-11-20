import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { daysLabel, filterContacts, isDueToday, isOverdue, lastTouch, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { ContactRowMenu } from "@/components/ProfileActions";
import { Empty, PageHeader, StageBadge, TypeBadge } from "@/components/ui";
import { formatDate } from "@/lib/util";
import { money } from "@/lib/target";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { contacts, interactions, surveys } = await loadAll();

  // Extra filters used by links from charts and stat tiles.
  const ids = f.ids ? new Set(f.ids.split(",")) : null;
  const surveyed = new Set(surveys.filter((s) => s.date_completed).map((s) => s.contact_id));
  const shortcut = f.label || (f.due ? "Follow-ups due today or overdue" : f.survey ? "Completed the survey" : "");
  const rows = filterContacts(contacts, f)
    .filter((c) => (!ids || ids.has(c.id)) && (!f.due || isOverdue(c) || isDueToday(c)) && (!f.survey || surveyed.has(c.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const manyOwners = owners(contacts).length > 1;
  return (
    <>
      <PageHeader title="All contacts" subtitle={`Everyone across research, outreach, onboarding and retention · ${rows.length} of ${contacts.length}`}>
        <Link href="/contacts/import" className="btn">Import CSV</Link>
        <a href="/api/contacts/export" className="btn" download>Export CSV</a>
        <Link href="/contacts/new" className="btn btn-primary">+ Add contact</Link>
      </PageHeader>
      {shortcut && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="chip bg-forest/10 text-forest">Showing: {shortcut}</span>
          <Link href="/contacts" className="text-xs link">Show everyone</Link>
        </div>
      )}
      <FilterBar owners={owners(contacts)} />
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th><th>Stage / status</th><th>Follow-up</th><th className="text-right">Deal</th>
                {manyOwners && <th>Owner</th>}<th>Last touch</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="group">
                  <td className="max-w-[18rem]">
                    <Link href={`/contacts/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                    <div className="truncate text-xs text-muted" title={[c.role, c.company].filter(Boolean).join(" · ")}>
                      {[c.role, c.company].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-0.5"><TypeBadge value={c.contact_type} /></div>
                  </td>
                  <td><div className="flex flex-col gap-1"><StageBadge value={c.stage} /><StageBadge value={c.research_status} track="research" /></div></td>
                  <td className={`whitespace-nowrap ${isOverdue(c) ? "font-semibold text-coral" : "text-ink"}`}>{formatDate(c.next_followup_date)}</td>
                  <td className="text-right tabular-nums">
                    {c.deal_value ? money(c.deal_value) : <span className="text-faint">—</span>}
                    {c.deal_status === "won" && <div className="text-[11px] font-semibold uppercase tracking-wide text-forest">Won</div>}
                    {c.deal_status === "lost" && <div className="text-[11px] font-semibold uppercase tracking-wide text-coral">Lost</div>}
                  </td>
                  {manyOwners && <td className="text-muted">{c.owner}</td>}
                  <td className="whitespace-nowrap text-muted">{daysLabel(lastTouch(c.id, interactions))}</td>
                  <td className="w-px"><ContactRowMenu contact={c} testRedirect={process.env.EMAIL_TEST_REDIRECT} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : contacts.length ? (
        <Empty>No contacts match these filters. <Link href="/contacts" className="link">Clear filters</Link></Empty>
      ) : (
        <Empty>No contacts yet. <Link href="/contacts/new" className="btn btn-primary btn-sm ml-2">+ Add your first contact</Link></Empty>
      )}
    </>
  );
}
