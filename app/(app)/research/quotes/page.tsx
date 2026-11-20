import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { formatDate, splitList } from "@/lib/util";
import { byId, params } from "@/lib/views";
import { FilterBar } from "@/components/FilterBar";
import { Empty } from "@/components/ui";

export default async function QuotesWall({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = params(await searchParams);
  const { interviews, contacts } = await loadAll();
  const people = byId(contacts);
  const quotes = interviews.flatMap((iv) =>
    splitList(iv.key_quotes, "line").map((text) => ({ text, iv, themes: splitList(iv.themes), person: people.get(iv.contact_id) })));
  const allThemes = [...new Set(quotes.flatMap((q) => q.themes))].sort();
  const q = (f.q || "").toLowerCase();
  const shown = quotes.filter((x) =>
    (!f.theme || x.themes.includes(f.theme)) &&
    (!q || x.text.toLowerCase().includes(q) || (x.person?.name || "").toLowerCase().includes(q)));

  return (
    <>
      <FilterBar owners={[]} show={[]} extra={[{ name: "theme", label: "All themes", options: allThemes }]} />
      {shown.length ? (
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
          {shown.map((x, i) => (
            <figure key={i} className="card mb-3 break-inside-avoid p-4">
              <blockquote className="text-[15px] leading-relaxed">&ldquo;{x.text}&rdquo;</blockquote>
              <figcaption className="mt-3 text-xs text-muted">
                <Link href={`/contacts/${x.iv.contact_id}`} className="font-medium text-ink hover:underline">{x.person?.name}</Link>
                {x.person?.role && ` · ${x.person.role}`} · {formatDate(x.iv.date)}
              </figcaption>
              <div className="mt-2 flex flex-wrap gap-1">{x.themes.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            </figure>
          ))}
        </div>
      ) : <Empty>No quotes match. <Link href="/research/quotes" className="link">Clear filters</Link></Empty>}
    </>
  );
}
