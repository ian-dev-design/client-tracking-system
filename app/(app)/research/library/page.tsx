import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { INTERVIEW_PURPOSES } from "@/lib/data";
import { formatDate, splitList } from "@/lib/util";
import { byId, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { Empty } from "@/components/ui";

export default async function InterviewLibrary({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { interviews, contacts } = await loadAll();
  const people = byId(contacts);
  const allThemes = [...new Set(interviews.flatMap((i) => splitList(i.themes)))].sort();
  const roles = [...new Set(interviews.map((i) => people.get(i.contact_id)?.role || "").filter(Boolean))].sort();
  const companies = [...new Set(interviews.map((i) => people.get(i.contact_id)?.company || "").filter(Boolean))].sort();
  const q = (f.q || "").toLowerCase();

  const rows = interviews
    .map((iv) => ({ iv, p: people.get(iv.contact_id) }))
    .filter(({ iv, p }) =>
      (!f.theme || splitList(iv.themes).includes(f.theme)) &&
      (!f.role || p?.role === f.role) &&
      (!f.company || p?.company === f.company) &&
      (!f.purpose || iv.purpose === f.purpose) &&
      (!q || [iv.summary, iv.key_quotes, iv.pain_points, p?.name, p?.company].some((v) => (v || "").toLowerCase().includes(q))))
    .sort((a, b) => b.iv.date.localeCompare(a.iv.date));

  return (
    <>
      <FilterBar owners={[]} show={[]} extra={[
        { name: "theme", label: "All themes", options: allThemes },
        { name: "role", label: "All roles", options: roles },
        { name: "company", label: "All organizations", options: companies },
        { name: "purpose", label: "All purposes", options: [...INTERVIEW_PURPOSES] },
      ]} />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(({ iv, p }) => (
            <Link key={iv.id} href={`/contacts/${iv.contact_id}`} className="card block p-4 hover:border-line">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p?.name || "Unknown"}</span>
                <span className="text-sm text-muted">{[p?.role, p?.company].filter(Boolean).join(" · ")}</span>
                <span className="chip">{iv.purpose.replace("_", " ")}</span>
                {iv.extraction_status === "pending" && <span className="chip bg-sand/20 text-ink">findings pending</span>}
                <span className="ml-auto text-xs text-faint">{formatDate(iv.date)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">{iv.summary || "No summary yet."}</p>
              <div className="mt-2 flex flex-wrap gap-1">{splitList(iv.themes).map((t) => <span key={t} className="chip">{t}</span>)}</div>
            </Link>
          ))}
        </div>
      ) : <Empty>No interviews yet. Add one from a contact&apos;s profile or with /log-interview.</Empty>}
    </>
  );
}
