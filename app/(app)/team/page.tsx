import { currentUser } from "@/lib/auth";
import { isClosed, loadAll } from "@/lib/crm";
import { journeyOfContact } from "@/lib/journey";
import { team, teammateFor } from "@/lib/team";
import { isTrue, isUrgent, today } from "@/lib/util";
import { clientOptions, isOverdue, params, people } from "@/lib/views";
import { TeamBoard, type TeamClientCard, type TeamColumn, type TeamTaskCard } from "@/components/TeamBoard";
import { PageHeader } from "@/components/ui";

// Team: who's doing what. One column per teammate; drag to reassign tasks or client ownership.
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = params(await searchParams).view === "clients" ? "clients" : "tasks";
  const [user, { contacts, tasks }] = await Promise.all([currentUser(), loadAll()]);
  const me = user?.name || "";
  const mates = team();
  const byId = new Map(contacts.map((c) => [c.id, c]));

  // Which column a stored name/email belongs in: the teammate's name, or the raw value if they're not on the list.
  const columnKey = (value: string) => (value ? teammateFor(value, mates)?.name || value.trim() : "");

  const taskCards: TeamTaskCard[] = tasks.filter((t) => !isTrue(t.done)).map((t) => {
    const c = byId.get(t.contact_id);
    return {
      id: t.id, title: t.title, who: columnKey(t.assigned_to), assigned_to: t.assigned_to, due_date: t.due_date,
      overdue: !!t.due_date && t.due_date < today(), notes: t.notes || "", priority: t.priority || "", urgent: isUrgent(t),
      contact_id: t.contact_id, client: c?.name || "", stage: c ? journeyOfContact(c) : null,
    };
  });
  const clientCards: TeamClientCard[] = contacts.filter((c) => !isClosed(c)).map((c) => ({
    id: c.id, name: c.name, company: c.company, who: columnKey(c.owner), stage: journeyOfContact(c),
    stageLabel: c.stage || c.research_status, overdue: isOverdue(c), next_followup_date: c.next_followup_date,
  }));

  // Columns: every teammate, then anyone else work is assigned to (so nothing is hidden), then Unassigned.
  const names = people(me);
  const extra = [...new Set([...taskCards, ...clientCards].map((c) => c.who))].filter((w) => w && !names.includes(w)).sort();
  const columns: TeamColumn[] = [
    ...names.map((n) => ({ key: n, label: n === me ? `${n} (you)` : n, onTeam: true })),
    ...extra.map((n) => ({ key: n, label: n, onTeam: false })),
    { key: "", label: "Unassigned", onTeam: false },
  ];

  return (
    <>
      <PageHeader title="Team" subtitle="Who's working on what. Drag a card to another person to reassign it." />
      <TeamBoard key={view} view={view} columns={columns} tasks={taskCards} clients={clientCards}
        clientOptions={clientOptions(contacts)} people={names} me={me} />
    </>
  );
}
