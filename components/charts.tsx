// Donut chart in plain SVG (no chart library, renders on the server).
// Minimal numbers: the legend shows labels; counts and percentages appear on hover.

export type Slice = { label: string; value: number; color: string; href?: string };

export function Donut({ data, caption, href, empty = "Nothing yet", format = String, size = "md", showLegend = true }: {
  data: Slice[];
  caption?: string; // small text in the middle, e.g. "6 people"
  href?: string; // makes the whole chart a link (slices can also have their own href)
  empty?: string;
  format?: (value: number) => string; // how values read in the legend, e.g. money
  size?: "md" | "lg"; // lg = the dashboard's hero chart
  showLegend?: boolean; // false when the page shows its own list next to it
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 15.915; // circumference = 100, so dash lengths are percentages
  let offset = 25; // start at 12 o'clock
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  const ring = (
    <svg viewBox="0 0 42 42" className={`${size === "lg" ? "h-56 w-56" : "h-32 w-32"} shrink-0`} role="img" aria-label={data.map((d) => `${d.label} ${pct(d.value)}%`).join(", ")}>
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
