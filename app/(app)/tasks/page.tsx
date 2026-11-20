import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { isProspect, loadAll } from "@/lib/crm";
import { journey, journeyOfContact } from "@/lib/journey";
import { formatDate, isTrue, stamp, today } from "@/lib/util";
import { clientOptions, isDueToday, isMine, isOverdue, params, people, readyForInterview } from "@/lib/views";
import { FollowupCard, type FollowupAction } from "@/components/FollowupCard";
import { NewTaskButton } from "@/components/TaskForm";
import { TaskList, type TaskRow } from "@/components/TaskList";
import { PageHeader, SectionHead } from "@/components/ui";

/** The one next step that fits where someone is. */
function actionFor(c: Record<string, string>, ready: boolean): FollowupAction {
  if (ready) return "interview";
  if (c.stage === "Onboarding") return "checklist";
  if (c.stage === "Active / Retention") return "checkin";
  if (["Client Interview", "Qualified"].includes(c.stage) || (!isProspect(c) && ["Interview Scheduled", "Interviewed"].includes(c.research_status))) return "log";
  return "draft";
}

export default async function MyTasks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const [user, { contacts, tasks, interviews }] = await Promise.all([currentUser(), loadAll()]);
  const me = user?.name || "";
  const everyone = f.who === "all";
  const mineOnly = (value: string) => everyone || (!!user && isMine(value, user));
  const names = new Map(contacts.map((c) => [c.id, c.name]));
  const team = people(me);
  const clients = clientOptions(contacts);
  const now = today();

  const withName = (t: Record<string, string>): TaskRow => ({ ...t, contact_name: names.get(t.contact_id) || "" });
  const byDue = (a: Record<string, string>, b: Record<string, string>) => (a.due_date || "9999").localeCompare(b.due_date || "9999");
  const open = tasks.filter((t) => mineOnly(t.assigned_to) && !isTrue(t.done)).sort(byDue).map(withName);
  const overdue = open.filter((t) => t.due_date && t.due_date < now);
  const dueToday = open.filter((t) => t.due_date === now);
  const upcoming = open.filter((t) => !t.due_date || t.due_date > now);
  // Finished in the last week, so a mis-click is easy to undo.
  const weekAgo = stamp(new Date(Date.now() - 7 * 86400000));
  const done = tasks.filter((t) => mineOnly(t.assigned_to) && isTrue(t.done) && t.done_at >= weekAgo)
    .sort((a, b) => b.done_at.localeCompare(a.done_at)).map(withName);

  const followups = contacts.filter((c) => mineOnly(c.owner) && (isOverdue(c) || isDueToday(c)))
    .sort((a, b) => a.next_followup_date.localeCompare(b.next_followup_date));

  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`-mb-px border-b-2 py-2 text-sm ${on ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
  );
  const group = (title: string, rows: TaskRow[], tone = "") => rows.length > 0 && (
    <div className="mb-6">
      <div className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${tone || "text-muted"}`}>{title} · {rows.length}</div>
      <TaskList tasks={rows} clients={clients} people={team} me={me} showContact />
    </div>
  );

  return (
    <>
      <PageHeader title="My tasks" subtitle="Your to-dos and the follow-ups that are due.">
        <NewTaskButton clients={clients} people={team} defaultAssignee={me} />
      </PageHeader>
      <div className="mb-8 flex gap-6 border-b border-line">
        {tab("/tasks", "Mine", !everyone)}
        {tab("/tasks?who=all", "Everyone", everyone)}
      </div>

      <div className="grid gap-12 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead title={`Tasks (${open.length} open)`} />
          {open.length ? <>
            {group("Overdue", overdue, "text-coral")}
            {group("Today", dueToday, "text-ink")}
            {group("Upcoming", upcoming)}
          </> : <p className="muted">{everyone ? "No open tasks." : "Nothing assigned to you. Use + New task to add one."}</p>}
          {done.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink">Completed this week · {done.length}</summary>
              <div className="mt-2"><TaskList tasks={done} clients={clients} people={team} me={me} showContact /></div>
            </details>
          )}
        </section>

        <section className="lg:col-span-2">
          <SectionHead title={`Follow-ups due (${followups.length})`} />
          {followups.length ? (
            <div className="space-y-2">
              {followups.map((c) => {
                const late = isOverdue(c);
                const stage = journeyOfContact(c);
                return (
                  <FollowupCard key={c.id} contact={c} company={c.company} overdue={late}
                    reason={late ? `Follow-up overdue · ${formatDate(c.next_followup_date)}` : "Follow-up due today"}
                    accent={stage ? journey(stage).border : "border-l-line"}
                    action={actionFor(c, readyForInterview(c, interviews))} testRedirect={process.env.EMAIL_TEST_REDIRECT} />
                );
              })}
            </div>
          ) : <p className="muted">No follow-ups due. Logging an interaction lets you set the next date.</p>}
        </section>
      </div>
    </>
  );
}
