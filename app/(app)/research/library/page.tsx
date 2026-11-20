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
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Date</th><th>Summary</th><th>Themes</th><th>Purpose</th></tr></thead>
            <tbody>
              {rows.map(({ iv, p }) => (
                <tr key={iv.id}>
                  <td className="max-w-[14rem]">
                    <Link href={`/contacts/${iv.contact_id}?tab=research`} className="font-semibold hover:underline">{p?.name || "Unknown"}</Link>
                    <div className="truncate text-xs text-muted">{[p?.role, p?.company].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(iv.date)}</td>
                  <td className="min-w-[16rem] max-w-md">
                    <p className="line-clamp-2 text-muted">{iv.summary || "No summary yet."}</p>
                    {iv.extraction_status === "pending" && <span className="chip mt-1 bg-sand/20 text-ink">Findings pending</span>}
                  </td>
                  <td><div className="flex max-w-[14rem] flex-wrap gap-1">{splitList(iv.themes).map((t) => (
                    <Link key={t} href={`/research/library?theme=${encodeURIComponent(t)}`} className="chip hover:bg-line">{t}</Link>
                  ))}</div></td>
                  <td className="whitespace-nowrap text-muted">{iv.purpose.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : interviews.length ? (
        <Empty>No interviews match. <Link href="/research/library" className="link">Clear filters</Link></Empty>
      ) : <Empty>No interviews yet. Add one from a contact&apos;s profile (⋯ → Add interview) or with /log-interview.</Empty>}
    </>
  );
}
