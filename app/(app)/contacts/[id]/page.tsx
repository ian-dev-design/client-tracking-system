import Link from "next/link";
import { notFound } from "next/navigation";
import { aiEnabled } from "@/lib/ai";
import { isProspect, isResearch, loadAll, ownershipHistory } from "@/lib/crm";
import { PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data";
import { money } from "@/lib/target";
import { formatDate, splitList } from "@/lib/util";
import { clientOptions, isOverdue, people, readyForInterview, sortTasks } from "@/lib/views";
import { currentUser } from "@/lib/auth";
import { ContactActions } from "@/components/ContactActions";
import { ActionButton, MoveButton, StatusSelect } from "@/components/Widgets";
import { PageHeader, Stars, TypeBadge } from "@/components/ui";
import { SitesList } from "@/components/Sites";
import { TaskList } from "@/components/TaskList";
import { NewTaskButton } from "@/components/TaskForm";

const DEAL_LABEL: Record<string, { text: string; cls: string }> = {
  won: { text: "Won", cls: "bg-forest text-paper" },
  lost: { text: "Lost", cls: "bg-coral/15 text-coral" },
  open: { text: "Open", cls: "bg-wash text-ink" },
};


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { contacts, interactions, surveys, interviews, onboarding, organizations, sites, tasks, transcripts }] =
    await Promise.all([currentUser(), loadAll()]);
  const hasTranscript = new Set(transcripts.map((t) => t.interview_id));
  const c = contacts.find((x) => x.id === id);
  if (!c) notFound();
  const org = organizations.find((o) => o.id === c.organization_id);
  const orgPeople = org ? contacts.filter((x) => x.organization_id === org.id && x.id !== c.id) : [];
  const orgSites = org ? sites.filter((x) => x.organization_id === org.id) : [];
  const myTasks = sortTasks(tasks.filter((t) => t.contact_id === id));
  const me = user?.name || "";
  const team = people(me);
  // Timeline: interactions plus reassignments / hand-offs of this client and their tasks.
  const history = await ownershipHistory(id);
  const timeline: Record<string, string>[] = [
    ...interactions.filter((i) => i.contact_id === id).map((i) => ({ ...i, key: i.date + i.created_at, kind: "interaction" })),
    ...history.map((h) => ({ ...h, key: h.at.slice(0, 10) + h.at, kind: "ownership" })),
  ].sort((a, b) => b.key.localeCompare(a.key));
  const mySurveys = surveys.filter((s) => s.contact_id === id);
  const myInterviews = interviews.filter((i) => i.contact_id === id).sort((a, b) => b.date.localeCompare(a.date));
  const ob = onboarding.find((o) => o.contact_id === id);
  const ready = readyForInterview(c, interviews);

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/contacts" className="text-muted hover:underline">← Contacts</Link></div>
      <PageHeader title={c.name} subtitle={[c.role, c.company].filter(Boolean).join(" · ")}>
        <ContactActions contact={c} show={["draft", "interview", "log", "edit"]}
          testRedirect={process.env.EMAIL_TEST_REDIRECT} aiEnabled={aiEnabled()} />
      </PageHeader>

      {ready && (
        <div className="mb-6 border-l-[3px] border-forest bg-forest/[0.06] px-4 py-2.5 text-sm text-forest">
          Survey completed — ready to request an interview. Use <b>Draft outreach</b> (it picks the interview-request template).
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2"><TypeBadge value={c.contact_type} /><Stars value={c.fit_score} /></div>
            {/* Any stage can be picked; a research-only person becomes a prospect too. */}
            <div><div className="label">Pipeline stage</div>
              <StatusSelect contactId={c.id} field="stage" value={c.stage} options={PIPELINE_STAGES} /></div>
            {isResearch(c) && <div><div className="label">Research status</div>
              <StatusSelect contactId={c.id} field="research_status" value={c.research_status} options={RESEARCH_STATUSES} /></div>}
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Owner">{c.owner}</Field>
              <Field label="Next follow-up">
                <span className={isOverdue(c) ? "font-semibold text-coral" : ""}>{c.next_followup_date && formatDate(c.next_followup_date)}</span>
              </Field>
              <Field label="Email">{c.email && <a className="link block truncate" title={c.email} href={`mailto:${c.email}`}>{c.email}</a>}</Field>
              <Field label="Phone">{c.phone}</Field>
              <Field label="LinkedIn">{c.linkedin && <a className="link" href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`} target="_blank">Profile ↗</a>}</Field>
              <Field label="Source">{c.source}</Field>
              {c.lost_reason && <Field label="Lost reason">{c.lost_reason}</Field>}
              <Field label="Added">{formatDate(c.created_at)}</Field>
            </dl>
            {c.notes && <div><div className="label">Notes</div><p className="whitespace-pre-wrap text-sm">{c.notes}</p></div>}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {c.contact_type === "research_participant" && (
                <ActionButton url={`/api/contacts/${c.id}`} body={{ action: "convert" }} label="Convert to prospect"
                  confirmText={`Turn ${c.name} into a prospect? Their research history stays.`} />
              )}
              {["Qualified", "Client Interview"].includes(c.stage) && <MoveButton contactId={c.id} name={c.name} to="onboarding" />}
              {c.stage === "Onboarding" && <MoveButton contactId={c.id} name={c.name} to="active" />}
              {c.stage === "Active / Retention" && <MoveButton contactId={c.id} name={c.name} to="churn" />}
            </div>
          </section>

          {isProspect(c) && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="h2">Deal</h2>
                <span className={`rounded-xs px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${(DEAL_LABEL[c.deal_status] || DEAL_LABEL.open).cls}`}>
                  {(DEAL_LABEL[c.deal_status] || DEAL_LABEL.open).text}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Deal value">{c.deal_value && <span className="text-lg font-semibold tabular-nums">{money(c.deal_value)}</span>}</Field>
                <Field label="Quote">{c.quote_amount && money(c.quote_amount)}</Field>
                <Field label={c.deal_status === "won" ? "Closed" : "Expected close"}>{c.expected_close_date && formatDate(c.expected_close_date)}</Field>
              </dl>
              <Link href={`/contacts/${c.id}/edit`} className="mt-3 inline-block text-xs font-medium text-forest hover:underline">Edit deal →</Link>
            </section>
          )}

          {ob && (
            <section className="card p-5">
              <h2 className="h2 mb-2">Onboarding</h2>
              <p className="text-sm">{ob.progress_pct || 0}% complete · health {ob.health || "green"}</p>
              {ob.blockers && <p className="mt-1 text-sm text-muted">Blockers: {ob.blockers}</p>}
              <Link href="/onboarding" className="link mt-2 inline-block text-sm">Open tracker →</Link>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="h2">Tasks</h2>
              <NewTaskButton small clients={clientOptions(contacts)} people={team} defaultAssignee={c.owner || me} contactId={c.id} />
            </div>
            <TaskList tasks={myTasks} clients={clientOptions(contacts)} people={team} me={me} empty="No tasks for this contact yet." />
          </section>

          {org && (
            <section className="card p-5">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="h2">Organization</h2>
                <Link href={`/organizations/${org.id}`} className="text-xs font-medium text-forest hover:underline">Open →</Link>
              </div>
              <div className="text-lg font-bold tracking-tight">{org.name}</div>
              <div className="text-sm text-muted">{[org.type, org.address].filter(Boolean).join(" · ")}</div>
              {orgPeople.length > 0 && (
                <div className="mt-4">
                  <div className="label">Other people here</div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {orgPeople.map((p) => <li key={p.id}><Link href={`/contacts/${p.id}`} className="hover:underline">{p.name}</Link> <span className="text-muted">· {p.role || "—"}</span></li>)}
                  </ul>
                </div>
              )}
              <div className="label mt-4">Sites ({orgSites.length})</div>
              <SitesList sites={orgSites} organizationId={org.id} />
            </section>
          )}

          {myInterviews.map((iv) => (
            <section key={iv.id} className="card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="h2">Interview · {formatDate(iv.date)}</h2>
                <span className="chip">{iv.purpose.replace("_", " ")}</span>
                {iv.extraction_status === "pending" && <span className="chip bg-sand/20 text-ink">Findings pending — run /log-interview</span>}
                {(hasTranscript.has(iv.id) || iv.transcript_link) && (
                  <Link href={`/interviews/${iv.id}/transcript`} className="link ml-auto text-sm">View transcript →</Link>
                )}
              </div>
              {iv.summary && <p className="text-sm text-ink">{iv.summary}</p>}
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {iv.pain_points && <div><div className="label">Pain points</div>
                  <ul className="list-disc space-y-0.5 pl-4 text-sm">{splitList(iv.pain_points, "line").map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
                {iv.current_tools && <div><div className="label">Current tools & vendors</div><p className="text-sm">{iv.current_tools}</p></div>}
                {iv.workflow && <div><div className="label">Workflow</div><p className="text-sm">{iv.workflow}</p></div>}
                {iv.willingness_to_pay && <div><div className="label">Willingness to pay</div><p className="text-sm">{iv.willingness_to_pay}</p></div>}
              </div>
              {iv.key_quotes && (
                <div className="mt-3 space-y-2">
                  {splitList(iv.key_quotes, "line").map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-line pl-3 text-sm italic text-ink">&ldquo;{q}&rdquo;</blockquote>
                  ))}
                </div>
              )}
              {(iv.themes || iv.surprises) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {splitList(iv.themes).map((t) => <Link key={t} href={`/research?theme=${encodeURIComponent(t)}`} className="chip hover:bg-wash">{t}</Link>)}
                  {iv.surprises && <span className="text-xs text-muted">· Surprise: {iv.surprises}</span>}
                </div>
              )}
            </section>
          ))}

          {mySurveys.map((s) => (
            <section key={s.id} className="card p-5">
              <h2 className="h2 mb-2">Survey · completed {formatDate(s.date_completed)}</h2>
              {s.key_takeaways
                ? <div className="mb-3 rounded-sm bg-surface p-3 text-sm whitespace-pre-wrap">{s.key_takeaways}</div>
                : <p className="mb-3 text-xs text-ink">Takeaways pending — run /log-survey in Claude Code.</p>}
              <details>
                <summary className="cursor-pointer text-sm text-muted">All answers</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm">{s.responses}</p>
              </details>
            </section>
          ))}

          <section className="card p-5">
            <h2 className="h2 mb-3">Timeline</h2>
            {timeline.length ? (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {timeline.map((i) => i.kind === "ownership" ? (
                  <li key={i.id} className="relative">
                    <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-line ring-2 ring-white" aria-hidden />
                    <div className="text-sm text-muted">{i.details}</div>
                    <div className="text-xs text-faint">{formatDate(i.at)} · {i.action === "handoff" ? "hand-off" : "reassigned"}</div>
                  </li>
                ) : (
                  <li key={i.id} className="relative">
                    <span className={`absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full ring-2 ring-white ${i.type === "note" ? "bg-faint" : "bg-forest"}`} aria-hidden />
                    <div className="text-sm"><span className="font-medium">{i.summary || i.type}</span></div>
                    <div className="text-xs text-faint">{formatDate(i.date)} · {i.type} via {i.channel} · by {i.logged_by}</div>
                    {i.email_body && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-forest">View sent email</summary>
                        <div className="mt-1 rounded-sm bg-surface p-3 text-sm">
                          {i.email_subject && <div className="mb-1 font-medium">{i.email_subject}</div>}
                          <div className="whitespace-pre-wrap text-ink">{i.email_body}</div>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            ) : <p className="muted">No interactions yet.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
