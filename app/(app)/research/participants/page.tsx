import Link from "next/link";
import { isResearch, loadAll } from "@/lib/crm";
import { RESEARCH_STATUSES } from "@/lib/data";
import { formatDate } from "@/lib/util";
import { filterContacts, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { StatusSelect } from "@/components/Widgets";
import { ContactRowMenu } from "@/components/ProfileActions";
import { Empty, TypeBadge } from "@/components/ui";

export default async function Participants({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { contacts, interviews } = await loadAll();
  const rows = filterContacts(contacts.filter(isResearch), f);
  return (
    <>
      <FilterBar owners={owners(contacts)} stages={RESEARCH_STATUSES} />
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Research status</th><th>Follow-up</th><th>Interviews</th><th>Owner</th><th>Type</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="group">
                  <td><Link href={`/contacts/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                    <div className="text-xs text-muted">{[c.role, c.company].filter(Boolean).join(" · ")}</div></td>
                  <td><StatusSelect contactId={c.id} field="research_status" value={c.research_status} options={RESEARCH_STATUSES} /></td>
                  <td className="whitespace-nowrap">{formatDate(c.next_followup_date)}</td>
                  <td className="tabular-nums text-muted">{interviews.filter((i) => i.contact_id === c.id).length}</td>
                  <td className="text-muted">{c.owner}</td>
                  <td><TypeBadge value={c.contact_type} /></td>
                  <td className="w-px"><ContactRowMenu contact={c} testRedirect={process.env.EMAIL_TEST_REDIRECT} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No research participants yet. <Link href="/contacts/new" className="btn btn-primary btn-sm ml-2">+ Add a contact</Link></Empty>}
    </>
  );
}
