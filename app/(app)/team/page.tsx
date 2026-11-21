import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { isClosed, loadAll } from "@/lib/crm";
import { journeyOfContact } from "@/lib/journey";
import { team } from "@/lib/team";
import { activityFeed, completedAt, efficiency, personKey, teamPeople } from "@/lib/teamStats";
import { contactUrgency, type Urgency } from "@/lib/urgency";
import { daysSince, isTrue, today } from "@/lib/util";
import { clientOptions, isOverdue, params, people } from "@/lib/views";
import { Donut, HBars } from "@/components/charts";
import { HandOffButton } from "@/components/HandOff";
import { TeamActivity } from "@/components/TeamActivity";
import { TeamWorkload, type TeamClientCard, type TeamTaskCard } from "@/components/TeamBoard";
import { NewTaskButton } from "@/components/TaskForm";
import { Avatar, PageHeader } from "@/components/ui";

const TABS = [{ key: "workload", label: "Workload" }, { key: "efficiency", label: "Efficiency" }, { key: "activity", label: "Activity" }] as const;
const PERIODS = [7, 30, 90];

/** A task's urgency on its row: overdue and urgent are red, due today is amber. */
function taskUrgency(t: Record<string, string>): Urgency {
  const now = today();
  if (t.due_date && t.due_date < now) return { level: "red", text: `Overdue ${daysSince(t.due_date)}d` };
  if (t.priority === "Urgent") return { level: "red", text: "Urgent" };
  if (t.due_date === now) return { level: "amber", text: "Due today" };
  return null;
}

// Team: see everyone's workload, assign and reassign work, and see how things are going.
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const tab = TABS.some((t) => t.key === f.tab) ? f.tab : "workload";
  const view = f.view === "clients" ? "clients" : "tasks";
  const period = PERIODS.includes(Number(f.period)) ? Number(f.period) : 30;
  const [user, data] = await Promise.all([currentUser(), loadAll()]);
  const { contacts, tasks } = data;
  const me = user?.name || "";
  const mates = team();
  const names = people(me);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const key = (v: string) => personKey(v, mates);
  const now = today();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);

  const taskCards: TeamTaskCard[] = tasks
    .filter((t) => !isTrue(t.done) || (completedAt(t) && new Date(completedAt(t).replace(" ", "T")) >= twoWeeksAgo))
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
    .map((t) => {
      const c = byId.get(t.contact_id);
      const done = isTrue(t.done);
      return {
        id: t.id, title: t.title, who: key(t.assigned_to), assigned_to: t.assigned_to, due_date: t.due_date,
        overdue: !done && !!t.due_date && t.due_date < now, notes: t.notes || "", priority: t.priority || "",
        contact_id: t.contact_id, client: c?.name || "", stage: c ? journeyOfContact(c) : null, urgency: taskUrgency(t),
        done, completedAt: completedAt(t),
        group: done ? "done" : t.due_date && t.due_date < now ? "overdue" : t.due_date === now ? "today" : "upcoming",
      };
    });
  const clientCards: TeamClientCard[] = contacts.filter((c) => !isClosed(c)).map((c) => ({
    id: c.id, name: c.name, company: c.company, who: key(c.owner), stage: journeyOfContact(c),
    stageLabel: c.stage || c.research_status, overdue: isOverdue(c), next_followup_date: c.next_followup_date, urgency: contactUrgency(c, tasks),
  }));
  const everyone = teamPeople(names, me, [...taskCards.map((t) => t.who), ...clientCards.map((c) => c.who)]);
  const initialWho = f.who !== undefined && everyone.some((p) => p.key === f.who) ? f.who : null;

  const tabLink = (k: string) => `/team?tab=${k}${k === "efficiency" ? `&period=${period}` : ""}`;
  const eff = tab === "efficiency" ? efficiency(tasks, everyone.filter((p) => p.onTeam), mates, period) : null;

  return (
    <>
      <PageHeader title="Team" subtitle="See everyone's workload and assign tasks.">
        <HandOffButton columns={everyone} tasks={taskCards.filter((t) => !t.done)} clients={clientCards} />
        <NewTaskButton clients={clientOptions(contacts)} people={names} defaultAssignee={me} />
      </PageHeader>

      <nav className="mb-8 flex gap-6 border-b border-line" aria-label="Team views">
        {TABS.map((t) => (
          <Link key={t.key} href={tabLink(t.key)} aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 py-2 text-sm ${tab === t.key ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</Link>
        ))}
      </nav>

      {tab === "workload" && (
        <TeamWorkload view={view} people={everyone} tasks={taskCards} clients={clientCards}
          clientOptions={clientOptions(contacts)} names={names} me={me} initialWho={initialWho} />
      )}

      {tab === "efficiency" && eff && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-ink">{eff.takeaway}</p>
            <nav className="flex border border-line bg-white text-sm" aria-label="Period">
              {PERIODS.map((p) => (
                <Link key={p} href={`/team?tab=efficiency&period=${p}`} aria-current={p === period ? "page" : undefined}
                  className={`border-l border-line px-3 py-1.5 first:border-l-0 ${p === period ? "bg-forest font-medium text-white" : "text-muted hover:bg-surface hover:text-ink"}`}>{p} days</Link>
              ))}
            </nav>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {eff.rows.map((r) => (
              <section key={r.key} className="border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <Avatar name={r.key} />
                  <h3 className="text-sm font-semibold text-ink">{r.label}</h3>
                </div>
                <div className="mt-4 flex items-center gap-5">
                  <div className="relative">
                    <Donut size="sm" showLegend={false} data={r.completed
                      ? [{ label: "On time", value: r.onTime, color: "#2f6b4f" }, { label: "Late", value: r.late, color: "#b84a2c" }]
                      : []} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-ink">{r.onTimePct === null ? "—" : `${r.onTimePct}%`}</span>
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-xs text-muted">Completed</dt><dd className="font-semibold tabular-nums">{r.completed}</dd></div>
                    <div><dt className="text-xs text-muted">On time</dt><dd className="font-semibold tabular-nums">{r.onTimePct === null ? "—" : `${r.onTimePct}%`}</dd></div>
                    <div><dt className="text-xs text-muted">Avg days to finish</dt><dd className="font-semibold tabular-nums">{r.avgDays ?? "—"}</dd></div>
                    <div><dt className="text-xs text-muted">Overdue now</dt>
                      <dd className={`flex items-center gap-1.5 font-semibold tabular-nums ${r.overdueNow ? "text-coral" : ""}`}>
                        {r.overdueNow > 0 && <span className="h-2 w-2 rounded-full bg-current text-urgent motion-safe:animate-glow" aria-hidden />}{r.overdueNow}
                      </dd></div>
                  </dl>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-sm text-muted">{r.takeaway}</p>
              </section>
            ))}
          </div>
          <section className="mt-10 max-w-2xl">
            <h3 className="label">Tasks completed per person · last {period} days</h3>
            {eff.total
              ? <HBars color="#1f3a2e" rows={eff.rows.map((r) => ({ label: r.label, value: r.completed }))} />
              : <p className="text-sm text-muted">Not enough data yet: no tasks were finished in this period.</p>}
          </section>
        </>
      )}

      {tab === "activity" && <TeamActivity items={activityFeed(data, mates)} people={everyone} initialWho={initialWho} />}
    </>
  );
}
