// The four stages of the customer journey, in timeline order.
// Each has one accent color (from app/globals.css), used only as a thin bar or a light tint.
// Tailwind needs full class names written out, so they're listed here literally.

export type JourneyKey = "research" | "outreach" | "onboarding" | "retention";

export type JourneyStage = {
  key: JourneyKey;
  n: number;
  label: string;
  href: string;
  purpose: string; // short, for the sidebar
  description: string; // one sentence, for the page header
  hex: string; // chart color
  bg: string; // solid accent (thin bars)
  border: string; // left accent border
  tint: string; // light background (active item, row / header tints)
  ink: string; // text color that stays readable on the tint
  tag: string; // tag / chip: tint background + ink text
  underline: string; // active tab underline
};

export const JOURNEY: JourneyStage[] = [
  {
    key: "research", n: 1, label: "Research", href: "/research",
    purpose: "Learn people's problems",
    description: "Survey and interview people to understand their problems. Nobody is being sold to here.",
    hex: "#5b8fa8", bg: "bg-research", border: "border-l-research", tint: "bg-research/10",
    ink: "text-research-ink", tag: "bg-research/12 text-research-ink", underline: "border-research",
  },
  {
    key: "outreach", n: 2, label: "Outreach", href: "/board",
    purpose: "Find & sign customers",
    description: "Move prospects from first contact to qualified: send outreach, collect surveys, run discovery calls.",
    hex: "#2f6b4f", bg: "bg-outreach", border: "border-l-outreach", tint: "bg-outreach/10",
    ink: "text-outreach-ink", tag: "bg-outreach/12 text-outreach-ink", underline: "border-outreach",
  },
  {
    key: "onboarding", n: 3, label: "Onboarding", href: "/onboarding",
    purpose: "Set new clients up",
    description: "Take each new client from handoff to a success review, one stage at a time.",
    hex: "#7b5ea7", bg: "bg-onboarding", border: "border-l-onboarding", tint: "bg-onboarding/12",
    ink: "text-onboarding-ink", tag: "bg-onboarding/15 text-onboarding-ink", underline: "border-onboarding",
  },
  {
    key: "retention", n: 4, label: "Retention", href: "/retention",
    purpose: "Keep customers happy",
    description: "Keep clients healthy, catch anyone going quiet, and stay ahead of renewals.",
    hex: "#2a8c8c", bg: "bg-retention", border: "border-l-retention", tint: "bg-retention/10",
    ink: "text-retention-ink", tag: "bg-retention/12 text-retention-ink", underline: "border-retention",
  },
];

export const journey = (key: JourneyKey) => JOURNEY.find((j) => j.key === key)!;

/** Which journey stage a pipeline stage or research status belongs to. */
export function journeyOf(value: string): JourneyKey | null {
  if (["To Contact", "Contacted", "Interview Scheduled", "Interviewed", "Done"].includes(value)) return "research";
  if (["Lead", "Outreach", "Survey Completed", "Client Interview", "Qualified"].includes(value)) return "outreach";
  if (value === "Onboarding") return "onboarding";
  if (value === "Active / Retention") return "retention";
  return null;
}

/** Which journey stage a contact is in right now (pipeline stage wins over research status). */
export function journeyOfContact(c: { stage?: string; research_status?: string }): JourneyKey | null {
  return journeyOf(c.stage || "") || (c.research_status && c.research_status !== "Done" ? "research" : null);
}

/** Mix two hex colors: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/**
 * n tints of a stage color, lighter → deeper, for a board's column headers (progress reads left to right).
 * Always dark text on top (every tint stays ≥ 8:1 with ink), plus a thin darker bottom edge in the stage color.
 */
export function stageShades(hex: string, n: number): { bg: string; fg: string; edge: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.2 : 0.1 + (i / (n - 1)) * 0.25; // 10% → 35% tint
    return { bg: mix("#ffffff", hex, t), fg: "#1e2a25", edge: hex };
  });
}
