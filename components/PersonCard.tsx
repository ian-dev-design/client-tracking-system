"use client";

// The card used on the boards and on the dashboard: a thin stage-colored bar on the left,
// name, company, a meta line, tags, and a footer for actions.

import Link from "next/link";

export type Tag = { label: string; tone?: "ready" | "alert" | "due" | "plain" };

const TONE = {
  ready: "bg-success/10 text-outreach-ink",
  alert: "bg-coral/10 text-coral", // overdue / at risk only
  due: "bg-amber/15 text-amber-ink", // due today, quiet, blocked: worth a look, not late
  plain: "bg-wash text-muted",
};

export function PersonCard({ name, company, href, accent, meta, tags = [], aside, footer, className = "" }: {
  name: string; company?: string; href?: string;
  accent: string; // a border-l-* class from lib/journey.ts
  meta?: React.ReactNode; tags?: Tag[]; aside?: React.ReactNode; footer?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`group flex h-full flex-col border border-l-[3px] border-line bg-white p-3.5 ${accent} ${className}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {href
            ? <Link href={href} className="block truncate text-[15px] font-semibold text-ink hover:underline" onPointerDown={(e) => e.stopPropagation()}>{name}</Link>
            : <div className="truncate text-[15px] font-semibold text-ink">{name}</div>}
          <div className="truncate text-sm text-muted">{company || "—"}</div>
        </div>
        {aside}
      </div>
      {meta && <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">{meta}</div>}
      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {tags.map((t, i) => <span key={i} title={t.label} className={`max-w-full truncate rounded-xs px-1.5 py-0.5 text-[11px] font-medium ${TONE[t.tone || "plain"]}`}>{t.label}</span>)}
        </div>
      )}
      {footer && <div className="mt-auto">{footer}</div>}
    </div>
  );
}
