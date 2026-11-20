import Link from "next/link";
import { notFound } from "next/navigation";
import { aiEnabled } from "@/lib/ai";
import { isProspect, isResearch, loadAll, ownershipHistory } from "@/lib/crm";
import { PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data";
import { JOURNEY, journeyOfContact } from "@/lib/journey";
import { money } from "@/lib/target";
import { formatDate, isTrue, splitList } from "@/lib/util";
import { actionFor, clientOptions, isOverdue, params, people, readyForInterview, sortTasks } from "@/lib/views";
import { currentUser } from "@/lib/auth";
import { CopyButton, ProfileActions } from "@/components/ProfileActions";
import { StatusSelect } from "@/components/Widgets";
import { SitesList } from "@/components/Sites";
import { TaskList } from "@/components/TaskList";
import { NewTaskButton } from "@/components/TaskForm";
import { TypeBadge } from "@/components/ui";

const DEAL_LABEL: Record<string, { text: string; cls: string }> = {
  won: { text: "Won", cls: "bg-forest text-paper" },
  lost: { text: "Lost", cls: "bg-coral/15 text-coral" },
  open: { text: "Open", cls: "bg-wash text-ink" },
};

// Normal-case section title with an optional link on the right.
function Title({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>{right}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

type Item = Record<string, string>;

/** One timeline entry: an interaction, or a reassignment / hand-off. */
function TimelineItem({ i }: { i: Item }) {
  if (i.kind === "ownership") {
    return (
      <li className="relative">
        <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-line ring-2 ring-paper" aria-hidden />
        <div className="text-sm text-muted">{i.details}</div>
        <div className="text-xs text-faint">{formatDate(i.at)} · {i.action === "handoff" ? "hand-off" : "reassigned"}</div>
      </li>
    );
  }
  return (
    <li className="relative">
      <span className={`absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full ring-2 ring-paper ${i.type === "note" ? "bg-faint" : "bg-forest"}`} aria-hidden />
      <div className="text-sm font-medium">{i.summary || i.type}</div>
      <div className="text-xs text-faint">{formatDate(i.date)} · {i.type} via {i.channel} · by {i.logged_by}</div>
      {i.email_body && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-forest">View sent email</summary>
          <div className="mt-1 border-l-2 border-line pl-3 text-sm">
            {i.email_subject && <div className="mb-1 font-medium">{i.email_subject}</div>}
            <div className="whitespace-pre-wrap text-ink">{i.email_body}</div>
          </div>
        </details>
      )}
    </li>
  );
}

export default async function ContactPage({ params: p, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await p;
  const f = params(await searchParams);
  const [user, { contacts, interactions, surveys, interviews, onboarding, organizations, sites, tasks, transcripts }] =
    await Promise.all([currentUser(), loadAll()]);
  const c = contacts.find((x) => x.id === id);
  if (!c) notFound();
  const hasTranscript = new Set(transcripts.map((t) => t.interview_id));
  const org = organizations.find((o) => o.id === c.organization_id);
  const orgPeople = org ? contacts.filter((x) => x.organization_id === org.id && x.id !== c.id) : [];
  const orgSites = org ? sites.filter((x) => x.organization_id === org.id) : [];
  const myTasks = sortTasks(tasks.filter((t) => t.contact_id === id));
  const openTasks = myTasks.filter((t) => !isTrue(t.done));
  const me = user?.name || "";
  const team = people(me);
  const history = await ownershipHistory(id);
  const timeline: Item[] = [
    ...interactions.filter((i) => i.contact_id === id).map((i) => ({ ...i, key: i.date + i.created_at, kind: "interaction" })),
    ...history.map((h) => ({ ...h, key: h.at.slice(0, 10) + h.at, kind: "ownership" })),
  ].sort((a, b) => b.key.localeCompare(a.key));
  const mySurveys = surveys.filter((s) => s.contact_id === id);
  const myInterviews = interviews.filter((i) => i.contact_id === id).sort((a, b) => b.date.localeCompare(a.date));
  const ob = onboarding.find((o) => o.contact_id === id);
  const ready = readyForInterview(c, interviews);
  const current = journeyOfContact(c);
  const currentIdx = JOURNEY.findIndex((j) => j.key === current);
  const deal = DEAL_LABEL[c.deal_status] || DEAL_LABEL.open;

  // Tabs; Organization, Deal and Research only show when there's something in them.
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "timeline", label: `Timeline${timeline.length ? ` (${timeline.length})` : ""}` },
    { key: "tasks", label: `Tasks${openTasks.length ? ` (${openTasks.length})` : ""}` },
    ...(org ? [{ key: "org", label: "Organization & sites" }] : []),
    ...(isProspect(c) ? [{ key: "deal", label: "Deal" }] : []),
    ...(myInterviews.length || mySurveys.length ? [{ key: "research", label: "Research" }] : []),
  ];
  const tab = tabs.some((t) => t.key === f.tab) ? f.tab : "overview";

  return (
    <>
      <div className="mb-3 text-sm"><Link href="/contacts" className="text-muted hover:underline">← Contacts</Link></div>

      {/* Header: who, where they are in the journey, the key facts, how to reach them, one primary action */}
      <header className="mb-6 border-b border-line pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h1">{c.name}</h1>
            <p className="mt-1 text-[15px] text-muted">
              {c.role}{c.role && (org || c.company) && " · "}
              {org ? <Link href={`/organizations/${org.id}`} className="hover:text-ink hover:underline">{org.name}</Link> : c.company}
            </p>
          </div>
          <ProfileActions contact={c} primary={actionFor(c, ready)} testRedirect={process.env.EMAIL_TEST_REDIRECT} aiEnabled={aiEnabled()} />
        </div>

        {/* Journey tracker across the four stages */}
        <ol className="mt-5 grid max-w-2xl grid-cols-4 gap-1.5" aria-label="Journey">
          {JOURNEY.map((j, i) => {
            const isCurrent = i === currentIdx, past = currentIdx >= 0 && i < currentIdx;
            return (
              <li key={j.key} aria-current={isCurrent ? "step" : undefined}>
                <div className={`h-1 ${isCurrent ? j.bg : past ? `${j.bg} opacity-40` : "bg-line"}`} />
                <div className={`mt-1.5 truncate text-xs ${isCurrent ? "font-semibold text-ink" : "text-muted"}`}>
                  {j.label}{isCurrent && <span className="font-normal text-muted"> · {c.stage || c.research_status}</span>}
                </div>
              </li>
            );
          })}
        </ol>
        {currentIdx < 0 && <p className="mt-2 text-xs font-semibold text-coral">{c.stage || c.research_status || "No stage"}</p>}

        {/* One fact line */}
        <p className="mt-4 flex flex-wrap gap-x-2 text-sm text-muted">
          <span>Owner <span className="text-ink">{c.owner || "—"}</span></span>
          <span aria-hidden>·</span>
          <span>Follow-up <span className={isOverdue(c) ? "font-semibold text-coral" : "text-ink"}>{c.next_followup_date ? formatDate(c.next_followup_date) : "—"}</span></span>
          {c.source && <><span aria-hidden>·</span><span>Source <span className="text-ink">{c.source}</span></span></>}
          {isProspect(c) && c.deal_value && <><span aria-hidden>·</span><span>Deal <span className="text-ink">{money(c.deal_value)}</span> {deal.text.toLowerCase()}</span></>}
        </p>

        {/* Contact line */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {c.email ? <span className="flex items-center gap-2"><a className="link" href={`mailto:${c.email}`}>{c.email}</a><CopyButton value={c.email} /></span>
            : <span className="text-faint">No email</span>}
          {c.phone && <><span className="text-faint" aria-hidden>·</span><span>{c.phone}</span></>}
          {c.linkedin && <><span className="text-faint" aria-hidden>·</span>
            <a className="link" href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`} target="_blank">LinkedIn ↗</a></>}
        </p>
      </header>

      <nav className="mb-8 flex gap-6 overflow-x-auto border-b border-line" aria-label="Sections">
        {tabs.map((t) => (
          <Link key={t.key} href={t.key === "overview" ? `/contacts/${id}` : `/contacts/${id}?tab=${t.key}`} scroll={false}
            className={`-mb-px shrink-0 border-b-2 py-2 text-sm ${tab === t.key ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="space-y-10 lg:col-span-3">
            <section>
              <Title>Next step</Title>
              <ul className="space-y-2 text-sm">
                {ready && <li className="border-l-[3px] border-forest pl-3 text-forest">Survey completed: ready to request an interview (use <b>Request interview</b> above).</li>}
                <li className="border-l-[3px] border-line pl-3">
                  {c.next_followup_date
                    ? <>Follow up <span className={isOverdue(c) ? "font-semibold text-coral" : "font-medium"}>{isOverdue(c) ? `overdue since ${formatDate(c.next_followup_date)}` : formatDate(c.next_followup_date)}</span></>
                    : <span className="text-muted">No follow-up date set. Logging an interaction sets one.</span>}
                </li>
                {openTasks[0] && (
                  <li className="border-l-[3px] border-line pl-3">
                    Next task: <Link href={`/contacts/${id}?tab=tasks`} className="font-medium hover:underline">{openTasks[0].title}</Link>
                    {openTasks[0].due_date && <span className="text-muted"> · due {formatDate(openTasks[0].due_date)}</span>}
                  </li>
                )}
                {ob && (
                  <li className="border-l-[3px] border-sand pl-3">
                    Onboarding {ob.progress_pct || 0}% complete · health {ob.health || "green"}
                    {ob.blockers && <span className="text-muted"> · Blocked: {ob.blockers}</span>}
                    {" "}<Link href="/onboarding" className="link">Open tracker</Link>
                  </li>
                )}
                {c.lost_reason && <li className="border-l-[3px] border-coral pl-3">Lost: {c.lost_reason}</li>}
              </ul>
            </section>

            <section>
              <Title>Notes</Title>
              {c.notes ? <p className="whitespace-pre-wrap text-sm">{c.notes}</p>
                : <p className="muted">No notes yet. <Link href={`/contacts/${id}/edit`} className="link">Add notes</Link></p>}
            </section>

            <section>
              <Title right={timeline.length > 3 && <Link href={`/contacts/${id}?tab=timeline`} className="text-xs font-medium text-forest hover:underline">Full timeline →</Link>}>Latest activity</Title>
              {timeline.length ? (
                <ol className="relative space-y-4 border-l border-line pl-5">{timeline.slice(0, 3).map((i) => <TimelineItem key={i.id} i={i} />)}</ol>
              ) : <p className="muted">Nothing logged yet. Use <b>Log interaction</b> in the ⋯ menu after a call or email.</p>}
            </section>
          </div>

          <aside className="space-y-8 lg:col-span-2">
            <section>
              <Title>Stage</Title>
              <div className="space-y-3">
                {/* Any stage can be picked; a research-only person becomes a prospect too. */}
                <div><div className="label">Pipeline stage</div>
                  <StatusSelect contactId={c.id} field="stage" value={c.stage} options={PIPELINE_STAGES} /></div>
                {isResearch(c) && <div><div className="label">Research status</div>
                  <StatusSelect contactId={c.id} field="research_status" value={c.research_status} options={RESEARCH_STATUSES} /></div>}
              </div>
            </section>
            <section>
              <Title right={<Link href={`/contacts/${id}/edit`} className="text-xs font-medium text-forest hover:underline">Edit</Link>}>Details</Title>
              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                <Field label="Type"><TypeBadge value={c.contact_type} /></Field>
                <Field label="Fit">{c.fit_score && `${c.fit_score}/5`}</Field>
                <Field label="Phone">{c.phone}</Field>
                <Field label="Added">{formatDate(c.created_at)}</Field>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {tab === "timeline" && (
        <section className="max-w-3xl">
          {timeline.length ? (
            <ol className="relative space-y-4 border-l border-line pl-5">{timeline.map((i) => <TimelineItem key={i.id} i={i} />)}</ol>
          ) : <p className="muted">Nothing logged yet. Use <b>Log interaction</b> in the ⋯ menu after a call or email.</p>}
        </section>
      )}

      {tab === "tasks" && (
        <section className="max-w-3xl">
          <Title right={<NewTaskButton small clients={clientOptions(contacts)} people={team} defaultAssignee={c.owner || me} contactId={c.id} />}>Tasks</Title>
          <TaskList tasks={myTasks} clients={clientOptions(contacts)} people={team} me={me}
            empty="No tasks for this contact yet. Use + New task to add one." />
        </section>
      )}

      {tab === "org" && org && (
        <div className="grid max-w-4xl gap-10 lg:grid-cols-2">
          <section>
            <Title right={<Link href={`/organizations/${org.id}`} className="text-xs font-medium text-forest hover:underline">Open organization →</Link>}>{org.name}</Title>
            <p className="text-sm text-muted">{[org.type, org.address].filter(Boolean).join(" · ") || "No type or address yet."}</p>
            <div className="label mt-6">Other people here</div>
            {orgPeople.length ? (
              <ul className="divide-y divide-line border-y border-line text-sm">
                {orgPeople.map((x) => <li key={x.id} className="py-2"><Link href={`/contacts/${x.id}`} className="font-medium hover:underline">{x.name}</Link> <span className="text-muted">· {x.role || "—"}</span></li>)}
              </ul>
            ) : <p className="muted">Nobody else from {org.name} yet.</p>}
          </section>
          <section>
            <Title>Sites ({orgSites.length})</Title>
            <SitesList sites={orgSites} organizationId={org.id} />
          </section>
        </div>
      )}

      {tab === "deal" && isProspect(c) && (
        <section className="max-w-xl">
          <Title right={<span className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${deal.cls}`}>{deal.text}</span>}>Deal</Title>
          <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
            <Field label="Deal value">{c.deal_value && <span className="text-lg font-semibold tabular-nums">{money(c.deal_value)}</span>}</Field>
            <Field label="Quote">{c.quote_amount && money(c.quote_amount)}</Field>
            <Field label={c.deal_status === "won" ? "Closed" : "Expected close"}>{c.expected_close_date && formatDate(c.expected_close_date)}</Field>
          </dl>
          <Link href={`/contacts/${c.id}/edit`} className="btn btn-sm mt-5">Edit deal</Link>
        </section>
      )}

      {tab === "research" && (
        <div className="max-w-3xl space-y-12">
          {myInterviews.map((iv) => (
            <section key={iv.id}>
              <Title right={(hasTranscript.has(iv.id) || iv.transcript_link) && <Link href={`/interviews/${iv.id}/transcript`} className="text-xs font-medium text-forest hover:underline">View transcript →</Link>}>
                Interview · {formatDate(iv.date)} <span className="chip ml-1 align-middle">{iv.purpose.replace("_", " ")}</span>
              </Title>
              {iv.extraction_status === "pending" && <p className="mb-3 border-l-[3px] border-sand pl-3 text-sm">Findings pending: run /log-interview in Claude Code.</p>}
              {iv.summary && <p className="text-sm text-ink">{iv.summary}</p>}
              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                {iv.pain_points && <div><div className="label">Pain points</div>
                  <ul className="list-disc space-y-0.5 pl-4 text-sm">{splitList(iv.pain_points, "line").map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                {iv.current_tools && <div><div className="label">Current tools & vendors</div><p className="text-sm">{iv.current_tools}</p></div>}
                {iv.workflow && <div><div className="label">Workflow</div><p className="text-sm">{iv.workflow}</p></div>}
                {iv.willingness_to_pay && <div><div className="label">Willingness to pay</div><p className="text-sm">{iv.willingness_to_pay}</p></div>}
              </div>
              {iv.key_quotes && (
                <div className="mt-4 space-y-2">
                  {splitList(iv.key_quotes, "line").map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-line pl-3 text-sm italic text-ink">&ldquo;{q}&rdquo;</blockquote>
                  ))}
                </div>
              )}
              {(iv.themes || iv.surprises) && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {splitList(iv.themes).map((t) => <Link key={t} href={`/research?theme=${encodeURIComponent(t)}`} className="chip hover:bg-line">{t}</Link>)}
                  {iv.surprises && <span className="text-xs text-muted">· Surprise: {iv.surprises}</span>}
                </div>
              )}
            </section>
          ))}
          {mySurveys.map((s) => (
            <section key={s.id}>
              <Title>Survey · completed {formatDate(s.date_completed)}</Title>
              {s.key_takeaways
                ? <p className="whitespace-pre-wrap border-l-2 border-line pl-3 text-sm">{s.key_takeaways}</p>
                : <p className="text-sm text-muted">Takeaways pending: run /log-survey in Claude Code.</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-forest">All answers</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm">{s.responses}</p>
              </details>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
