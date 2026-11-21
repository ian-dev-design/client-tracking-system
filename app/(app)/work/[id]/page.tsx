import Link from "next/link";
import { notFound } from "next/navigation";
import { aiEnabled } from "@/lib/ai";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { dashboardData } from "@/lib/dashboard";
import { journeyOfContact, journey } from "@/lib/journey";
import { formatDate } from "@/lib/util";
import { onboardingView, people } from "@/lib/views";
import { CopyButton } from "@/components/ProfileActions";
import { AssignControl, WorkDraft, WorkInterview, WorkOnboarding, WorkQuiet, WorkTask } from "@/components/WorkPanels";

const TITLES = {
  followup: "Follow up", task: "Finish the task", interview: "Request an interview", onboarding: "Move onboarding forward", quiet: "Check in",
} as const;

// "Work on this": one Needs attention item, with the work itself right here.
// The content depends on why they need attention (follow-up, task, interview, onboarding, quiet client).
export default async function WorkOnThis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([currentUser(), loadAll()]);
  const c = data.contacts.find((x) => x.id === id);
  if (!c) notFound();
  const { needsAttention } = dashboardData(data);
  const index = needsAttention.findIndex((a) => a.c.id === id);
  const item = needsAttention[index];
  const top = item?.reasons[0];
  // Next item: the following row, or the first one if this item is already resolved.
  const next = index >= 0 ? needsAttention[index + 1] : needsAttention[0];
  const nextHref = next ? `/work/${next.c.id}` : null;

  const stageKey = journeyOfContact(c);
  const j = stageKey ? journey(stageKey) : null;
  const org = data.organizations.find((o) => o.id === c.organization_id);
  const task = top?.kind === "task" ? data.tasks.find((t) => t.id === top.taskId) : undefined;
  const ob = data.onboarding.find((o) => o.contact_id === id);
  const recent = data.interactions.filter((i) => i.contact_id === id)
    .sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at)).slice(0, 3);
  const testRedirect = process.env.EMAIL_TEST_REDIRECT;
  const late = top && (top.tone === "critical" || top.tone === "alert");

  return (
    <>
      <div className="mb-3 text-sm"><Link href="/" className="text-muted hover:underline">← Dashboard</Link></div>

      {/* Header: who, why, and who's on it */}
      <header className={`mb-8 border-l-[3px] px-5 py-5 sm:px-6 ${j ? `${j.border} ${j.tint}` : "border-l-line bg-surface"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h1">{c.name}</h1>
            <p className="mt-1 text-[15px] text-muted">
              {org ? org.name : c.company}{(org || c.company) && " · "}
              <span className={j ? `font-medium ${j.ink}` : ""}>{c.stage || c.research_status || "No stage"}</span>
            </p>
            {top ? (
              <p className={`mt-3 text-sm font-semibold ${late ? "text-coral" : top.tone === "due" ? "text-amber-ink" : "text-outreach-ink"}`}>
                {top.detail}{item.reasons.length > 1 && <span className="font-normal text-muted"> · also: {item.reasons.slice(1).map((r) => r.short).join(", ")}</span>}
              </p>
            ) : <p className="mt-3 text-sm text-muted">Nothing needs attention for {c.name} right now.</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <AssignControl kind={task ? "task" : "client"} id={task ? task.id : c.id} value={task ? task.assigned_to : c.owner}
              people={people(user?.name || "")} label={task ? "Assign task to" : "Assign to"} />
            <Link href={`/contacts/${c.id}`} className="text-sm font-medium text-info hover:underline">Open client profile →</Link>
          </div>
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* The work itself */}
        <section className="min-w-0 lg:col-span-2">
          {top && <h2 className="mb-4 text-base font-semibold text-ink">{TITLES[top.kind]}</h2>}
          {!top ? (
            <p className="muted">All clear. Pick the next item below, or open the profile to do something else.</p>
          ) : top.kind === "task" && task ? (
            <WorkTask task={task} client={c.name} nextHref={nextHref} />
          ) : top.kind === "interview" ? (
            <WorkInterview contact={c} testRedirect={testRedirect} nextHref={nextHref} aiEnabled={aiEnabled()} />
          ) : top.kind === "onboarding" && ob ? (
            <WorkOnboarding item={onboardingView(ob, c)} />
          ) : top.kind === "quiet" ? (
            <WorkQuiet contact={c} testRedirect={testRedirect} nextHref={nextHref} />
          ) : (
            <WorkDraft contactId={c.id} testRedirect={testRedirect} nextHref={nextHref} />
          )}
        </section>

        {/* Context: how to reach them, notes, what happened lately */}
        <aside className="space-y-8">
          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Contact</h3>
            <dl className="space-y-1.5 text-sm">
              {c.role && <div className="text-muted">{c.role}</div>}
              {c.email ? <div className="flex items-center gap-2"><a className="link truncate" href={`mailto:${c.email}`}>{c.email}</a><CopyButton value={c.email} /></div>
                : <div className="text-faint">No email</div>}
              {c.phone && <div>{c.phone}</div>}
              <div className="text-muted">Owner <span className="text-ink">{c.owner || "—"}</span> · Follow-up <span className="text-ink">{c.next_followup_date ? formatDate(c.next_followup_date) : "—"}</span></div>
            </dl>
          </section>
          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Notes</h3>
            {c.notes ? <p className="whitespace-pre-wrap text-sm">{c.notes}</p> : <p className="muted">No notes.</p>}
          </section>
          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Last 3 activities</h3>
            {recent.length ? (
              <ul className="divide-y divide-line border-y border-line text-sm">
                {recent.map((i) => (
                  <li key={i.id} className="py-2">
                    <div className="font-medium">{i.summary || i.type}</div>
                    <div className="text-xs text-faint">{formatDate(i.date)} · {i.type} · by {i.logged_by}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Nothing logged yet.</p>}
          </section>
        </aside>
      </div>

      <nav className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-5">
        <Link href="/" className="btn">← Back to dashboard</Link>
        {nextHref
          ? <Link href={nextHref} className="text-sm font-medium text-info hover:underline">Next item: {next!.c.name} →</Link>
          : <span className="text-sm text-muted">This is the last item.</span>}
      </nav>
    </>
  );
}
