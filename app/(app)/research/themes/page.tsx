import Link from "next/link";
import { loadAll } from "@/lib/crm";
import { formatDate, splitList } from "@/lib/util";
import { Empty } from "@/components/ui";

export default async function ThemesPage() {
  const { themes, interviews } = await loadAll();
  const ranked = [...themes].sort((a, b) => Number(b.interview_count) - Number(a.interview_count));
  const max = Math.max(1, ...ranked.map((t) => Number(t.interview_count) || 0));
  const total = interviews.length;
  if (!ranked.length) return <Empty>No themes yet. Run /research-synthesis in Claude Code.</Empty>;
  return (
    <div className="space-y-3">
      <p className="muted">Ranked by how many of the {total} interviews mention each theme. Updated by /research-synthesis.</p>
      {ranked.map((t, i) => (
        <div key={t.id} className="card p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-faint">#{i + 1}</span>
            <Link href={`/research/library?theme=${encodeURIComponent(t.theme)}`} className="font-medium hover:underline">{t.theme}</Link>
            <span className="text-xs text-muted">{t.interview_count} of {total} interviews</span>
            <span className="ml-auto text-xs text-faint">updated {formatDate(t.last_updated)}</span>
          </div>
          <Link href={`/research/library?theme=${encodeURIComponent(t.theme)}`} title="See these interviews" className="mt-2 block h-1 bg-wash">
            <div className="h-full bg-research" style={{ width: `${((Number(t.interview_count) || 0) / max) * 100}%` }} />
          </Link>
          {t.description && <p className="mt-2 text-sm text-muted">{t.description}</p>}
          <div className="mt-2 space-y-1.5">
            {splitList(t.example_quotes, "line").slice(0, 3).map((q, j) => (
              <blockquote key={j} className="border-l-2 border-research pl-3 text-sm italic text-muted">&ldquo;{q}&rdquo;</blockquote>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
