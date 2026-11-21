// Donut chart in plain SVG (no chart library, renders on the server).
// Minimal numbers: the legend shows labels; counts and percentages appear on hover.

export type Slice = { label: string; value: number; color: string; href?: string };

export function Donut({ data, caption, href, empty = "Nothing yet", format = String, size = "md", showLegend = true }: {
  data: Slice[];
  caption?: string; // small text in the middle, e.g. "6 people"
  href?: string; // makes the whole chart a link (slices can also have their own href)
  empty?: string;
  format?: (value: number) => string; // how values read in the legend, e.g. money
  size?: "sm" | "md" | "lg"; // lg = the dashboard's hero chart, sm = a small inline donut
  showLegend?: boolean; // false when the page shows its own list next to it
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 15.915; // circumference = 100, so dash lengths are percentages
  let offset = 25; // start at 12 o'clock
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  const ring = (
    <svg viewBox="0 0 42 42" className={`${size === "lg" ? "h-56 w-56" : size === "sm" ? "h-16 w-16" : "h-32 w-32"} shrink-0`} role="img" aria-label={data.map((d) => `${d.label} ${pct(d.value)}%`).join(", ")}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--color-wash)" strokeWidth="5" />
      {data.filter((d) => d.value > 0).map((d) => {
        const p = (d.value / total) * 100;
        const slice = (
          <circle cx="21" cy="21" r={r} fill="none" stroke={d.color} strokeWidth="5"
            strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={offset} className="transition-opacity hover:opacity-75">
            <title>{`${d.label}: ${format(d.value)} (${pct(d.value)}%)`}</title>
          </circle>
        );
        offset -= p;
        return d.href ? <a key={d.label} href={d.href}>{slice}</a> : <g key={d.label}>{slice}</g>;
      })}
      {caption && <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className={`fill-muted font-medium ${size === "lg" ? "text-[3px]" : "text-[3.6px]"}`}>{total ? caption : empty}</text>}
    </svg>
  );

  const legend = (
    <ul className="min-w-[8.5rem] flex-1 space-y-2">
      {data.map((d) => {
        const row = (
          <span className="group flex items-center gap-2 text-sm text-ink" title={`${format(d.value)} (${pct(d.value)}%)`}>
            <span className="h-2.5 w-2.5 shrink-0" style={{ background: d.color }} />
            <span className="truncate group-hover:underline">{d.label}</span>
            <span className="text-xs tabular-nums text-faint">{format(d.value)}</span>
          </span>
        );
        return <li key={d.label}>{d.href ? <a href={d.href}>{row}</a> : row}</li>;
      })}
    </ul>
  );

  const body = showLegend ? <div className="flex flex-wrap items-center gap-5">{ring}{legend}</div> : ring;
  return href ? <a href={href} className="block">{body}</a> : body;
}

/** One thin horizontal bar split into segments, with a legend (label + muted value) underneath. */
export function StackedBar({ data, format = String }: { data: Slice[]; format?: (value: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden bg-wash" role="img"
        aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}>
        {total > 0 && data.filter((d) => d.value > 0).map((d) => {
          const seg = <span className="block h-full transition-opacity hover:opacity-80" style={{ background: d.color }} title={`${d.label}: ${format(d.value)}`} />;
          return (
            <span key={d.label} className="block h-full" style={{ width: `${(d.value / total) * 100}%` }}>
              {d.href ? <a href={d.href} className="block h-full">{seg}</a> : seg}
            </span>
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
        {data.map((d) => {
          const row = (
            <span className="group flex items-center gap-2 text-sm text-ink">
              <span className="h-2.5 w-2.5 shrink-0" style={{ background: d.color }} />
              <span className="truncate group-hover:underline">{d.label}</span>
              <span className="text-xs tabular-nums text-faint">{format(d.value)}</span>
            </span>
          );
          return <li key={d.label}>{d.href ? <a href={d.href}>{row}</a> : row}</li>;
        })}
      </ul>
    </div>
  );
}

// ---------- Insights charts (plain HTML/SVG, server-rendered) ----------

export type FunnelRow = { label: string; count: number; pctPrev: number; pctStart: number; drop: boolean; stillHere?: number };

/**
 * Horizontal funnel: one bar per step, width = share of the first step.
 * Shows the count, % kept from the previous step and % of the start; the biggest drop gets a coral marker.
 * `mini` = one slim bar per step with just the count (for the stage-page strips).
 */
export function FunnelBars({ steps, color, mini = false }: { steps: FunnelRow[]; color: string; mini?: boolean }) {
  const max = Math.max(1, steps[0]?.count || 0);
  const n = steps.length;
  return (
    <ol className={mini ? "space-y-1" : "space-y-2.5"}>
      {steps.map((s, i) => {
        const fill = `color-mix(in srgb, ${color} ${Math.round(40 + (i / Math.max(1, n - 1)) * 60)}%, #ffffff)`;
        return (
          <li key={s.label} className={`grid items-center gap-3 ${mini ? "grid-cols-[6.5rem_1fr_2rem] text-xs" : "grid-cols-[8.5rem_1fr_8.5rem] text-sm"}`}>
            <span className="min-w-0 truncate text-ink">{s.label}
              {!mini && !!s.stillHere && <span className="block text-[11px] text-faint">{s.stillHere} still here</span>}
            </span>
            <span className={`relative block bg-wash ${mini ? "h-2" : "h-6"}`}>
              <span className="block h-full" style={{ width: `${(s.count / max) * 100}%`, background: fill }} />
              {/* the count sits just past the end of the bar (inside it only when the bar is nearly full, where the fill is light) */}
              {!mini && <span className="absolute inset-y-0 flex items-center text-xs font-semibold tabular-nums text-ink"
                style={{ left: (s.count / max) * 100 > 88 ? 8 : `calc(${(s.count / max) * 100}% + 6px)` }}>{s.count}</span>}
            </span>
            {mini ? <span className="text-right tabular-nums text-muted">{s.count}</span> : (
              <span className="flex items-center justify-end gap-2 text-xs tabular-nums text-muted">
                {i > 0 && <span className={s.drop ? "rounded-xs bg-coral/10 px-1.5 py-0.5 font-semibold text-coral" : ""}
                  title={s.drop ? "Biggest drop" : "Of the people who finished the step before"}>{s.pctPrev}% kept</span>}
                <span>{s.pctStart}%</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal bars with a value label, e.g. average days per stage. A null value shows "—". */
export function HBars({ rows, color, format = String, mini = false }: {
  rows: { label: string; value: number | null; hint?: string }[]; color: string; format?: (v: number) => string; mini?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <ul className={mini ? "space-y-1" : "space-y-2.5"}>
      {rows.map((r) => (
        <li key={r.label} className={`grid items-center gap-3 ${mini ? "grid-cols-[6.5rem_1fr_3rem] text-xs" : "grid-cols-[8.5rem_1fr_5rem] text-sm"}`}>
          <span className="truncate text-ink">{r.label}</span>
          <span className={`block bg-wash ${mini ? "h-2" : "h-4"}`} title={r.hint}>
            {r.value !== null && <span className="block h-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />}
          </span>
          <span className="text-right tabular-nums text-muted">{r.value !== null ? format(r.value) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Percent over time: a simple line with dots, 0–100% axis, month labels underneath. Gaps (null) break the line. */
export function LineChart({ points, color }: { points: { label: string; rate: number | null }[]; color: string }) {
  const W = 340, H = 170, L = 32, R = 10, T = 10, B = 24;
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const segments: string[] = [];
  let cur: string[] = [];
  points.forEach((p, i) => {
    if (p.rate === null) { if (cur.length) segments.push(cur.join(" ")); cur = []; return; }
    cur.push(`${x(i)},${y(p.rate)}`);
  });
  if (cur.length) segments.push(cur.join(" "));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={points.map((p) => `${p.label} ${p.rate === null ? "no data" : `${p.rate}%`}`).join(", ")}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={L - 6} y={y(v)} textAnchor="end" dominantBaseline="central" className="fill-faint text-[10px]">{v}%</text>
        </g>
      ))}
      {segments.map((s, i) => <polyline key={i} points={s} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />)}
      {points.map((p, i) => (
        <g key={i}>
          {p.rate !== null && <circle cx={x(i)} cy={y(p.rate)} r="3.5" fill="#fff" stroke={color} strokeWidth="2"><title>{`${p.label}: ${p.rate}%`}</title></circle>}
          <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Small vertical bars per month (e.g. churned clients), with the count on top and the month underneath. */
export function MonthBars({ months, color }: { months: { label: string; churned: number }[]; color: string }) {
  const max = Math.max(1, ...months.map((m) => m.churned));
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label={months.map((m) => `${m.label} ${m.churned}`).join(", ")}>
      {months.map((m, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted">{m.churned || ""}</span>
          <span className="block w-full" style={{ height: `${(m.churned / max) * 52}px`, minHeight: m.churned ? 3 : 1, background: m.churned ? color : "var(--color-line)" }} />
          <span className="truncate text-[10px] text-faint">{m.label.split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
}
