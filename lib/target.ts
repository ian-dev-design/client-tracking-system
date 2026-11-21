// Who we sell to, read from config.json. Change config.json to switch industries:
// templates, survey questions, interview guides, onboarding stages and retention signals all follow.
// (No env vars or secrets here, so this file is safe to use in the browser too.)

import raw from "@/config.json";

export type Step = { key: string; label: string };

export const target = raw.targetCustomer as {
  companyName: string;
  industry: string;
  whatWeSell: string;
  idealCustomer: string;
  customerTypes: string[];
  typicalRoles: string[];
  problemWeSolve: string;
  workArea: string; // short phrase for the work we help with, e.g. "grounds and land maintenance"
  welcomeNote?: string; // optional friendly line for the welcome email
};

/** An onboarding stage: one column on the Onboarding board, with its own checklist. Rename them in config.json. */
export type OnboardingStage = { key: string; label: string; description: string; steps: Step[] };
export const ONBOARDING_STAGES: OnboardingStage[] = raw.onboardingStages;

/** Every onboarding checklist step, in stage order. Each `key` is a column in the onboarding tab (plus `<key>_date`). */
export const ONBOARDING_STEPS: Step[] = ONBOARDING_STAGES.flatMap((s) => s.steps);

/** Signs a customer is sticking around. Each `key` is a column in the retention tab (plus `<key>_date`). */
export const RETENTION_SIGNALS: Step[] = raw.retentionSignals;

/** "a, b, or c" */
export const orList = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;

/** Labels for site fields, so the sites tab reads naturally for the industry (e.g. "Acreage", "Grazing dates"). */
export const SITE_CONFIG = raw.sites as { sizeLabel: string; sizeUnit: string; notesLabel: string; serviceLabel: string; statuses: string[] };

/** Money, e.g. "$12,500". Empty string for blank values. */
export function money(value: string | number): string {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  if (value === "" || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: raw.currency || "USD", maximumFractionDigits: 0 }).format(n);
}

/** Short money for tight spaces, e.g. "$12.5k". */
export function moneyShort(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return money(value);
}

/** Parse "$12,500" / "12500" into a number (0 if blank). */
export const amount = (value: string) => Number(String(value || "").replace(/[$,\s]/g, "")) || 0;
