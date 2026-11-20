// Small presentational pieces (no client JS).

import Link from "next/link";
import { journey, journeyOf, type JourneyKey } from "@/lib/journey";

/** The product mark: a solid forest dot and the name. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-forest" aria-hidden />
      <span className="text-sm font-semibold tracking-[-0.01em] text-ink">Client Tracking System</span>
    </div>
  );
}

/** Stage / status badge: a thin bar in the stage color, then the name. `track` disambiguates "Survey Completed". */
export function StageBadge({ value, track }: { value: string; track?: JourneyKey }) {
  if (!value) return null;
  const key = track || journeyOf(value);
  const bar = value === "Churned / Lost" ? "bg-coral" : key ? journey(key).bg : "bg-line";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
      <span className={`h-3 w-[3px] ${bar}`} aria-hidden />{value}
    </span>
  );
}

const TYPE_LABEL: Record<string, string> = { prospect: "Prospect", research_participant: "Research", both: "Prospect + Research" };
export function TypeBadge({ value }: { value: string }) {
  return <span className="text-xs text-muted">{TYPE_LABEL[value] || value}</span>;
}

// Health: green = forest, yellow = sand, red = coral.
export const HEALTH_COLOR: Record<string, string> = { green: "bg-forest", yellow: "bg-sand", red: "bg-coral" };
export function HealthDot({ value }: { value: string }) {
  return <span title={`Health: ${value || "green"}`} className={`inline-block h-2 w-2 rounded-full ${HEALTH_COLOR[value] || HEALTH_COLOR.green}`} />;
}

/** Page title. On a journey page pass `stage` to show "Step N of 4" and the stage's purpose. */
export function PageHeader({ title, subtitle, stage, children }: {
  title: string; subtitle?: string; stage?: JourneyKey; children?: React.ReactNode;
}) {
  const j = stage && journey(stage);
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        {j && (
          <div className="eyebrow mb-3 flex items-center gap-2">
            <span className={`h-3 w-[3px] ${j.bg}`} aria-hidden />Step {j.n} of 4
          </div>
        )}
        <h1 className="h1">{title}</h1>
        {(subtitle || j) && <p className="mt-2 max-w-2xl text-[15px] text-muted">{subtitle || j?.description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-line px-6 py-12 text-center text-sm text-muted">{children}</div>;
}

/** A section title row: small uppercase label on the left, an optional "Open →" link on the right. */
export function SectionHead({ title, href, linkText = "Open →" }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h2 className="h2">{title}</h2>
      {href && <Link href={href} className="text-xs font-medium text-forest hover:underline">{linkText}</Link>}
    </div>
  );
}

export function Stars({ value }: { value: string }) {
  const n = Number(value) || 0;
  if (!n) return <span className="text-faint">—</span>;
  return <span className="text-xs tabular-nums text-muted" title={`Fit ${n}/5`}>Fit {n}/5</span>;
}

export function ProgressBar({ pct, color = "bg-sand" }: { pct: number; color?: string }) {
  return (
    <div className="h-1 w-full bg-wash">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Small spinner for buttons that are working. */
export function Spinner() {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent align-[-1px]" aria-hidden />;
}

/** Initials in a plain circle. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-[11px]";
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface font-semibold text-muted ${dim}`}>{initials}</span>;
}
