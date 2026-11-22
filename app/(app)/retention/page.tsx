import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { retention } from "@/lib/insights";
import { HEALTH_COLUMNS, RENEWAL_COLUMNS, clientHealth, daysToRenewal, nextStep, renewalBucket, renewalValue, renewedRecently } from "@/lib/retention";
import { retentionUrgency } from "@/lib/urgency";
import { daysSince, parseStamp } from "@/lib/util";
import { filterContacts, owners, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { RetentionBoard, type RetentionCardView } from "@/components/RetentionBoard";
import { PageHeader } from "@/components/ui";

const TABS = [{ key: "health", label: "Health board" }, { key: "renewals", label: "Renewals" }] as const;

export default async function Retention({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const tab = f.tab === "renewals" ? "renewals" : "health";
  const data = await loadAll();
  const { contacts, interactions, tasks, retention: rows, stageHistory } = data;

  // Churned clients (they had been won / active) show in the Renewals board's Churned column for a year.
  const wasClient = (id: string) => rows.some((r) => r.contact_id === id) || stageHistory.some((h) => h.contact_id === id && h.to_stage === "Active / Retention");
  const churnedAt = (c: Record<string, string>) =>
    [...stageHistory].reverse().find((h) => h.contact_id === c.id && h.to_stage === "Churned / Lost")?.at || c.updated_at;
  const churnedRecently = (c: Record<string, string>) => c.stage === "Churned / Lost" && wasClient(c.id) && (daysSince(churnedAt(c).slice(0, 10)) ?? 999) <= 365;
  const clients = contacts.filter((c) => c.stage === "Active / Retention" || (tab === "renewals" && churnedRecently(c)));

  const cards: RetentionCardView[] = filterContacts(clients, f).map((c) => {
    const h = clientHealth(c, interactions, tasks);
    return {
      id: c.id, name: c.name, company: c.company, owner: c.owner, stage: c.stage, research_status: c.research_status, contact_type: c.contact_type,
      daysQuiet: h.daysQuiet, renewalDate: c.renewal_date, daysToRenewal: daysToRenewal(c), value: renewalValue(c),
      health: h.health, autoHealth: h.auto, autoReason: h.autoReason, manual: h.manual, reason: h.reason, bucket: renewalBucket(c),
      churnReason: c.lost_reason, lastRenewed: (c.last_renewed_at || "").slice(0, 10),
      urgency: retentionUrgency(c, tasks, h, daysToRenewal(c), renewedRecently(c)), nextStep: nextStep(c, tasks),
    };
  }).sort((a, b) => (a.daysToRenewal ?? 9999) - (b.daysToRenewal ?? 9999));

  // The slim line: 12-month retention, churn this calendar year, renewals coming up.
  const r12 = retention(data, "12m");
  const year = new Date().getFullYear();
  const churnedThisYear = contacts.filter((c) => c.stage === "Churned / Lost" && wasClient(c.id) && parseStamp(churnedAt(c)).getFullYear() === year).length;
  const active = contacts.filter((c) => c.stage === "Active / Retention");
  const renewSoon = active.filter((c) => ["30", "overdue"].includes(renewalBucket(c))).length;

  const columns = tab === "health"
    ? HEALTH_COLUMNS.map((h) => ({ key: h.key, label: h.label, dot: h.dot, hint: h.key === "green" ? "No healthy clients right now." : "Nobody here. Good." }))
    : RENEWAL_COLUMNS.map((c) => ({ key: c.key, label: c.label, hint: c.key === "renewed" ? "Drag a client here when they renew."
      : c.key === "churned" ? "No one has churned in the last year." : c.key === "overdue" ? "No overdue renewals. Good." : "No renewals in this window." }));

  return (
    <>
      <PageHeader title="Retention" stage="retention" />
      {/* One plain line of numbers; the charts are on the Insights page. */}
      <p className="-mt-2 mb-6 text-sm text-ink">
        Retention rate <b>{r12.rate === null ? "—" : `${r12.rate}%`}</b>
        <span className="mx-2 text-faint">·</span>{churnedThisYear} churned this year
        <span className="mx-2 text-faint">·</span><span className={renewSoon ? "font-medium text-retention-ink" : ""}>{renewSoon} renewal{renewSoon === 1 ? "" : "s"} in the next 30 days</span>
      </p>

      <nav className="mb-6 flex gap-6 border-b border-line" aria-label="Retention views">
        {TABS.map((t) => (
          <Link key={t.key} href={`/retention?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 py-2 text-sm ${tab === t.key ? "border-retention font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <FilterBar owners={owners(contacts)} show={owners(contacts).length > 1 ? ["owner"] : []} />
      {cards.length || tab === "renewals"
        ? <RetentionBoard key={tab + JSON.stringify(cards)} mode={tab} columns={columns} initial={cards} testRedirect={process.env.EMAIL_TEST_REDIRECT} />
        : <div className="border border-dashed border-line px-6 py-12 text-center text-sm text-muted">No active clients yet. When onboarding is done, the client moves here.
            <Link href="/onboarding" className="btn btn-sm ml-2">Open Onboarding</Link></div>}
    </>
  );
}
