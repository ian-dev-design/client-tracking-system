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
