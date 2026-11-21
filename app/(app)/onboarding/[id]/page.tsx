import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { ONBOARDING_STAGES, onboardingView, stageByKey } from "@/lib/onboarding";
import { amount, money } from "@/lib/target";
import { formatDate, timeAgo } from "@/lib/util";
import { people } from "@/lib/views";
import { HealthSelect, OnboardingField, StageChecklist, Stepper } from "@/components/OnboardingCard";
import { AssignControl } from "@/components/WorkPanels";
import { Empty } from "@/components/ui";

type Item = { key: string; when: string; text: string; who: string; dot: string };

// One client's onboarding: stepper, current stage checklist, notes, health, owner and timeline.
export default async function OnboardingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([currentUser(), loadAll()]);
  const c = data.contacts.find((x) => x.id === id);
  if (!c) notFound();
  const row = data.onboarding.find((o) => o.contact_id === id);
  const back = <div className="mb-3 text-sm"><Link href="/onboarding" className="text-muted hover:underline">← Onboarding</Link></div>;

  if (c.stage !== "Onboarding") {
    return (<>{back}<Empty>{c.name} isn&apos;t in onboarding right now (stage: {c.stage || c.research_status || "none"}).
      {" "}<Link href={`/contacts/${id}`} className="link">Open their profile</Link></Empty></>);
  }
  const v = onboardingView(row, c, amount(c.deal_value));
  const stageLabel = (k: string) => stageByKey(k)?.label || k;

  // Timeline: stage moves, checked steps and everything logged for this client since onboarding began.
  const since = row?.start_date || "";
  const items: Item[] = [
    ...data.stageHistory.filter((h) => h.contact_id === id && h.track === "onboarding").map((h) => ({
      key: h.at, when: h.at, who: h.by, dot: "bg-onboarding",
      text: h.from_stage ? `Moved from ${stageLabel(h.from_stage)} to ${stageLabel(h.to_stage)}` : `Started onboarding in ${stageLabel(h.to_stage)}`,
    })),
    ...ONBOARDING_STAGES.flatMap((s) => s.steps).filter((s) => row?.[`${s.key}_date`]).map((s) => ({
      key: `${row![`${s.key}_date`]} 00:00`, when: row![`${s.key}_date`], who: "", dot: "bg-success", text: `Checked off: ${s.label}`,
    })),
    ...data.interactions.filter((i) => i.contact_id === id && i.date >= since && !i.summary.startsWith("Onboarding: ")).map((i) => ({
      key: i.created_at || i.date, when: i.created_at || i.date, who: i.logged_by, dot: "bg-tl-note", text: i.summary || i.type,
    })),
  ].sort((a, b) => b.key.localeCompare(a.key));

  return (
    <>
      {back}
      <header className="mb-6 border-l-[3px] border-l-onboarding bg-onboarding/12 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h1">{c.name}</h1>
            <p className="mt-1 text-[15px] text-muted">
              {c.company}{c.company && " · "}<span className="font-medium text-onboarding-ink">{v.stageLabel}</span>
              {v.days !== null && <> · {v.days} day{v.days === 1 ? "" : "s"} in this stage</>}
              {v.value > 0 && <> · {money(v.value)}</>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AssignControl kind="client" id={c.id} value={c.owner} people={people(user?.name || "")} label="Owner" />
            <Link href={`/contacts/${c.id}`} className="text-sm font-medium text-info hover:underline">Open client profile →</Link>
          </div>
        </div>
      </header>

      <div className="mb-10"><Stepper view={v} /></div>

      <div className="grid gap-12 lg:grid-cols-3">
        <section className="min-w-0 space-y-8 lg:col-span-2">
          <StageChecklist view={v} />
          <div className="grid gap-6 sm:grid-cols-2">
            <OnboardingField view={v} field="handoff_notes" />
            <OnboardingField view={v} field="success_goals" />
          </div>
        </section>

        <aside className="space-y-8">
          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Health</h3>
            <HealthSelect view={v} />
            <p className="mt-2 text-xs text-muted">Started {formatDate(v.startDate)} · owner {c.owner || "—"}</p>
          </section>
          <OnboardingField view={v} field="blockers" />
          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Onboarding timeline</h3>
            {items.length ? (
              <ol className="relative space-y-3 border-l border-line pl-5">
                {items.slice(0, 15).map((i, n) => (
                  <li key={n} className="relative text-sm">
                    <span className={`absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full ring-2 ring-paper ${i.dot}`} aria-hidden />
                    <div className="text-ink">{i.text}</div>
                    <div className="text-xs text-faint">{i.when.length > 10 ? timeAgo(i.when) : formatDate(i.when)}{i.who && ` · ${i.who}`}</div>
                  </li>
                ))}
              </ol>
            ) : <p className="muted">Nothing yet.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
