import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAll } from "@/lib/crm";
import { journey, journeyOfContact } from "@/lib/journey";
import { amount, money } from "@/lib/target";
import { OrgButton } from "@/components/OrgForm";
import { SitesList } from "@/components/Sites";
import { PageHeader, SectionHead, StageBadge } from "@/components/ui";

export default async function Organization({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizations, contacts, sites } = await loadAll();
  const org = organizations.find((o) => o.id === id);
  if (!org) notFound();
  const people = contacts.filter((c) => c.organization_id === id);
  const orgSites = sites.filter((s) => s.organization_id === id);
  const open = people.filter((c) => !["won", "lost"].includes(c.deal_status)).reduce((s, c) => s + amount(c.deal_value), 0);
  const won = people.filter((c) => c.deal_status === "won").reduce((s, c) => s + amount(c.deal_value), 0);

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/organizations" className="text-muted hover:underline">← Organizations</Link></div>
      <PageHeader title={org.name} subtitle={[org.type, org.address].filter(Boolean).join(" · ")}>
        <OrgButton org={org} label="Edit" />
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8">
          <section>
            <SectionHead title="Deals" />
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-muted">Open</dt><dd className="text-2xl font-bold tabular-nums">{open ? money(open) : "—"}</dd></div>
              <div><dt className="text-xs text-muted">Won</dt><dd className="text-2xl font-bold tabular-nums">{won ? money(won) : "—"}</dd></div>
            </dl>
          </section>
          {org.notes && <section><SectionHead title="Notes" /><p className="whitespace-pre-wrap text-sm">{org.notes}</p></section>}
          <section>
            <SectionHead title={`People (${people.length})`} href={`/contacts/new?company=${encodeURIComponent(org.name)}`} linkText="+ Add contact" />
            {people.length ? (
              <ul className="space-y-2">
                {people.map((c) => {
                  const j = journeyOfContact(c);
                  return (
                    <li key={c.id} className={`border border-l-[3px] border-line bg-white p-3 ${j ? journey(j).border : "border-l-line"}`}>
                      <Link href={`/contacts/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted">{c.role || "—"}</div>
                      <div className="mt-1.5"><StageBadge value={c.stage || c.research_status} track={c.stage ? undefined : "research"} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">No one linked yet.</p>}
          </section>
        </div>
        <section className="lg:col-span-2">
          <SectionHead title={`Sites (${orgSites.length})`} />
          <SitesList sites={orgSites} organizationId={org.id} />
        </section>
      </div>
    </>
  );
}
