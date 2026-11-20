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
  tint: string; // light background (active item)
};

export const JOURNEY: JourneyStage[] = [
  {
    key: "research", n: 1, label: "Research", href: "/research",
    purpose: "Learn people's problems",
    description: "Survey and interview people to understand their problems. Nobody is being sold to here.",
    hex: "#9ab39a", bg: "bg-sage", border: "border-l-sage", tint: "bg-sage/15",
  },
  {
    key: "outreach", n: 2, label: "Outreach", href: "/board",
    purpose: "Find & sign customers",
    description: "Move prospects from first contact to qualified: send outreach, collect surveys, run discovery calls.",
    hex: "#2f5d4a", bg: "bg-pine", border: "border-l-pine", tint: "bg-pine/10",
  },
  {
    key: "onboarding", n: 3, label: "Onboarding", href: "/onboarding",
    purpose: "Set new clients up",
    description: "Get each new client through the onboarding checklist, from first step to done.",
    hex: "#c8a45d", bg: "bg-sand", border: "border-l-sand", tint: "bg-sand/15",
  },
  {
    key: "retention", n: 4, label: "Retention", href: "/retention",
    purpose: "Keep customers happy",
    description: "Stay in touch with active customers, track signs they’re sticking around, and catch anyone going quiet.",
    hex: "#a65e46", bg: "bg-clay", border: "border-l-clay", tint: "bg-clay/10",
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
 * n shades of a stage color, light → dark, for a board's column headers (progress reads left to right).
 * Each comes with a text color that stays readable on it.
 */
export function stageShades(hex: string, n: number): { bg: string; fg: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    // light tint of the color → the color → a deeper version of it
    const bg = t < 0.65 ? mix("#ffffff", hex, 0.22 + (t / 0.65) * 0.78) : mix(hex, "#141414", ((t - 0.65) / 0.35) * 0.35);
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(bg.slice(k, k + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { bg, fg: lum > 0.19 ? "#141414" : "#ffffff" }; // 0.19 ≈ where dark and white text have equal contrast
  });
}
