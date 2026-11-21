import Link from "next/link";

/**
 * A slim, collapsible chart strip above a stage board: one summary line (always visible),
 * a small chart when open, and a link to the Insights page.
 */
export function InsightStrip({ summary, href, children }: { summary: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <details open className="group -mt-8 mb-6 border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-faint transition-transform group-open:rotate-90" aria-hidden>▸</span>
        <span className="min-w-0 flex-1 text-ink">{summary}</span>
        <Link href={href} className="shrink-0 text-xs font-medium text-info hover:underline">Insights →</Link>
      </summary>
      <div className="max-w-2xl pb-4 pl-6">{children}</div>
    </details>
  );
}
