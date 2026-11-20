import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { amount, money } from "@/lib/target";
import { params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { OrgButton } from "@/components/OrgForm";
import { Empty, PageHeader } from "@/components/ui";

export default async function Organizations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { organizations, contacts, sites } = await loadAll();
  const q = (f.q || "").toLowerCase();
  const rows = organizations
    .filter((o) => (!f.type || o.type === f.type) && (!q || `${o.name} ${o.address}`.toLowerCase().includes(q)))
    .map((o) => {
      const people = contacts.filter((c) => c.organization_id === o.id);
      return {
        o, people, sites: sites.filter((s) => s.organization_id === o.id).length,
        open: people.filter((c) => c.deal_status !== "won" && c.deal_status !== "lost").reduce((s, c) => s + amount(c.deal_value), 0),
      };
    })
    .sort((a, b) => a.o.name.localeCompare(b.o.name));
  const types = [...new Set(organizations.map((o) => o.type).filter(Boolean))].sort();

  return (
    <>
      <PageHeader title="Organizations" subtitle={`Every organization, with its people and sites · ${rows.length} of ${organizations.length}`}>
        <OrgButton primary />
      </PageHeader>
      <FilterBar owners={[]} show={[]} extra={[{ name: "type", label: "All types", options: types }]} />
      {rows.length ? (
        <div className="relative overflow-x-auto border border-line bg-white">
          <table className="table">
            <thead><tr><th>Organization</th><th>Type</th><th>People</th><th>Sites</th><th className="text-right">Open deals</th></tr></thead>
            <tbody>
              {rows.map(({ o, people, sites, open }) => (
                <tr key={o.id}>
                  <td className="max-w-xs">
                    <Link href={`/organizations/${o.id}`} className="font-semibold hover:underline">{o.name}</Link>
                    {o.address && <div className="truncate text-xs text-muted" title={o.address}>{o.address}</div>}
                  </td>
                  <td className="text-muted">{o.type || "—"}</td>
                  <td>{people.map((p) => p.name).join(", ") || <span className="text-faint">—</span>}</td>
                  <td className="tabular-nums">{sites}</td>
                  <td className="text-right tabular-nums">{open ? money(open) : <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No organizations yet. They&rsquo;re created automatically when you add a contact with an organization name.</Empty>}
    </>
  );
}
