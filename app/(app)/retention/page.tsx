import { loadAll } from "@/lib/crm";
import { RETENTION_SIGNALS } from "@/lib/data";
import { daysSince, formatDate, isTrue } from "@/lib/util";
import { filterContacts, lastTouch, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { RetentionCard, type RetentionView } from "@/components/RetentionCard";
import { Empty, PageHeader } from "@/components/ui";

export default async function Retention({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { contacts, interactions, retention } = await loadAll();
  const items: RetentionView[] = filterContacts(contacts.filter((c) => c.stage === "Active / Retention"), f)
    .map((c) => {
      const row = retention.find((r) => r.contact_id === c.id);
      const last = lastTouch(c.id, interactions);
      return {
        id: row?.id || "", contact: c, notes: row?.notes || "",
        lastContact: last ? formatDate(last) : "", daysQuiet: daysSince(last),
        signals: RETENTION_SIGNALS.map((s) => ({ key: s.key, label: s.label, done: isTrue(row?.[s.key] || ""), date: row?.[`${s.key}_date`] || "" })),
      };
    })
    // quietest first
    .sort((a, b) => (b.daysQuiet ?? 9999) - (a.daysQuiet ?? 9999));

  return (
    <>
      <PageHeader title="Retention" stage="retention" />
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["owner"] : []} />
      {items.length
        ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <RetentionCard key={i.contact.id} item={i} testRedirect={process.env.EMAIL_TEST_REDIRECT} />)}</div>
        : <Empty>No active customers yet. Use &ldquo;Move to Active / Retention&rdquo; on an onboarding client.</Empty>}
    </>
  );
}
