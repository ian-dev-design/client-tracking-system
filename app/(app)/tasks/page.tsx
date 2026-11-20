import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { formatDate, isTrue } from "@/lib/util";
import { assignees, isDueToday, isOverdue, params, sortTasks } from "@/lib/views";
import { ContactActions } from "@/components/ContactActions";
import { TaskList } from "@/components/TaskList";
import { PageHeader, SectionHead, StageBadge } from "@/components/ui";

export default async function MyTasks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const [user, { contacts, tasks }] = await Promise.all([currentUser(), loadAll()]);
  const me = user?.name || "";
  const everyone = f.who === "all";
  const names = new Map(contacts.map((c) => [c.id, c.name]));

  // Tasks: open ones, plus anything finished in the last week so a mis-click is easy to undo.
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const shown = sortTasks(tasks.filter((t) => (everyone || t.assigned_to === me) && (!isTrue(t.done) || t.done_at >= weekAgo)))
    .map((t): Record<string, string> => ({ ...t, contact_name: names.get(t.contact_id) || "" }));

  // Follow-ups: the next_followup_date on contacts you own.
  const mine = contacts.filter((c) => everyone || c.owner === me || c.owner === user?.email);
  const followups = mine.filter((c) => isOverdue(c) || isDueToday(c)).sort((a, b) => a.next_followup_date.localeCompare(b.next_followup_date));
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`-mb-px border-b-2 py-2 text-sm ${on ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
  );

  return (
    <>
      <PageHeader title="My tasks" subtitle="Your to-dos and the follow-ups that are due. Check things off as you go." />
      <div className="mb-8 flex gap-6 border-b border-line">
        {tab("/tasks", "Mine", !everyone)}
        {tab("/tasks?who=all", "Everyone", everyone)}
      </div>

      <div className="grid gap-12 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead title={`Tasks (${shown.filter((t) => !isTrue(t.done)).length} open)`} />
          <TaskList tasks={shown} assignees={assignees(contacts, tasks, me)} me={me} showContact
            empty={everyone ? "No open tasks." : "Nothing assigned to you. Add one below, or from a contact's profile."} />
        </section>

        <section className="lg:col-span-2">
          <SectionHead title={`Follow-ups due (${followups.length})`} />
          {followups.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {followups.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/contacts/${c.id}`} className="truncate font-semibold hover:underline">{c.name}</Link>
                    <span className={`shrink-0 text-xs ${isOverdue(c) ? "font-semibold text-coral" : "text-ink"}`}>
                      {isOverdue(c) ? `Overdue · ${formatDate(c.next_followup_date)}` : "Today"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                    <span className="truncate">{c.company}</span>
                    <StageBadge value={c.stage || c.research_status} track={c.stage ? undefined : "research"} />
                  </div>
                  <div className="mt-2"><ContactActions contact={c} size="sm" show={["draft", "log", "view"]} testRedirect={process.env.EMAIL_TEST_REDIRECT} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No follow-ups due. Logging an interaction lets you set the next date.</p>}
        </section>
      </div>
    </>
  );
}
