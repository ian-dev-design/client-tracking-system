"use client";

// Shared pieces of the drag-and-drop boards (Outreach, Onboarding, Retention):
// a column with a tinted chevron header (name, total value, count) and an empty-column hint.

import { useDroppable } from "@dnd-kit/core";
import { moneyShort } from "@/lib/target";

export type Shade = { bg: string; fg: string; edge: string };

// Arrow-shaped column header. The first one has a flat left edge.
const CHEVRON = (first: boolean) =>
  `polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%${first ? "" : ", 10px 50%"})`;

export function Column({ id, label, index, count, value, shade, hint, subtitle, dot, narrow = false, children }: {
  id: string; // drop target id
  label: string;
  index: number;
  count: number;
  value: number;
  shade: Shade;
  hint?: React.ReactNode; // what an empty column says
  subtitle?: string; // one quiet line under the header (e.g. the stage's description)
  dot?: string; // optional status dot class in the header (e.g. bg-success)
  narrow?: boolean; // boards with 6 columns use slightly narrower ones so they fit
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex shrink-0 flex-col ${count ? `w-64 ${narrow ? "min-w-44" : "min-w-52"} flex-1` : "w-44 min-w-36 flex-[0.6]"}`}>
      <div className={`flex h-10 items-center justify-between gap-2 pr-5 ${index ? "pl-5" : "pl-3"}`}
        style={{ background: shade.bg, color: shade.fg, boxShadow: `inset 0 -2px 0 ${shade.edge}`, clipPath: CHEVRON(index === 0) }}>
        <span className="flex min-w-0 items-center gap-1.5">
          {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />}
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums">
          {value > 0 && <span className="mr-2 opacity-80">{moneyShort(value)}</span>}
          <span className="font-semibold">{count}</span>
        </span>
      </div>
      {subtitle && <p className="mt-1.5 truncate px-1 text-[11px] text-muted" title={subtitle}>{subtitle}</p>}
      <div className={`${subtitle ? "mt-2" : "mt-3"} flex min-h-28 flex-1 flex-col gap-2 p-1 transition-colors ${isOver ? "bg-forest/[0.05] outline-2 outline-dashed outline-forest/40" : ""}`}>
        {count ? children : (
          <div className="flex flex-col items-start border border-dashed border-line p-3 text-xs leading-relaxed text-muted">
            {hint || "Drag a card here."}
          </div>
        )}
      </div>
    </div>
  );
}
