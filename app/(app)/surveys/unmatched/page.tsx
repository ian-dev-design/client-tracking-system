import { loadAll } from "@/lib/crm";
import { formatDate } from "@/lib/util";
import { listUnmatched } from "@/lib/surveys";
import { SyncNowButton } from "@/components/SurveySync";
import { UnmatchedActions } from "@/components/Widgets";
import { Empty, PageHeader } from "@/components/ui";

export default async function Unmatched() {
  const [responses, { contacts }] = await Promise.all([listUnmatched(), loadAll()]);
  const options = contacts.map((c) => ({ id: c.id, label: `${c.name}${c.company ? ` — ${c.company}` : ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      <PageHeader title="Unmatched survey responses" subtitle="Responses whose email doesn't match any contact. Link them or create a contact.">
        <SyncNowButton />
      </PageHeader>
      {responses.length ? (
        <div className="space-y-3">
          {responses.map((r) => (
            <div key={r.key} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.email || "(no email given)"}</span>
                <span className="ml-auto text-xs text-faint">{formatDate(r.timestamp)}</span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {r.answers.slice(0, 6).map((a) => (
                  <div key={a.question}><dt className="text-xs text-muted">{a.question}</dt><dd>{a.answer}</dd></div>
                ))}
              </dl>
              <div className="mt-3 border-t border-line pt-3"><UnmatchedActions responseKey={r.key} contacts={options} /></div>
            </div>
          ))}
        </div>
      ) : <Empty>All survey responses are matched.</Empty>}
    </>
  );
}
