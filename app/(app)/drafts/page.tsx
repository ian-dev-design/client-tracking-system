import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { formatDate } from "@/lib/util";
import { byId } from "@/lib/views";
import { ActionButton, ReviewDraftsButton } from "@/components/Widgets";
import { Empty, PageHeader } from "@/components/ui";

export default async function DraftsPage() {
  const { drafts, contacts } = await loadAll();
  const people = byId(contacts);
  const pending = drafts.filter((d) => d.status === "pending").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ids = [...new Set(pending.map((d) => d.contact_id))];
  return (
    <>
      <PageHeader title="Drafts to review" subtitle="Drafts created by /outreach. Nothing sends until you approve each one.">
        <ReviewDraftsButton contactIds={ids} testRedirect={process.env.EMAIL_TEST_REDIRECT} label={`Review all (${ids.length})`} />
      </PageHeader>
      {pending.length ? (
        <div className="space-y-3">
          {pending.map((d) => {
            const c = people.get(d.contact_id);
            return (
              <div key={d.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/contacts/${d.contact_id}`} className="font-medium hover:underline">{c?.name || "Unknown"}</Link>
                  <span className="text-sm text-muted">{c?.company}</span>
                  <span className="chip">{d.template.replaceAll("_", " ")}</span>
                  <span className="ml-auto text-xs text-faint">by {d.created_by} · {formatDate(d.created_at)}</span>
                </div>
                <div className="mt-2 text-sm font-medium">{d.subject}</div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{d.body}</p>
                <div className="mt-3 flex gap-2">
                  <ReviewDraftsButton contactIds={[d.contact_id]} testRedirect={process.env.EMAIL_TEST_REDIRECT} label="Review & send" />
                  <ActionButton url={`/api/drafts/${d.id}`} body={{ status: "discarded" }} label="Discard" confirmText="Discard this draft? (It stays in the Sheet marked discarded.)" />
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty>No drafts waiting. Run /outreach in Claude Code, or draft one from any contact.
          <Link href="/board" className="btn btn-sm ml-2">Open Outreach board</Link></Empty>}
    </>
  );
}
