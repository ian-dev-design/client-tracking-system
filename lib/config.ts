import raw from "@/config.json";

// Non-secret IDs live in config.json. Env vars can override them (useful on Vercel).
export const config = {
  surveyLink: process.env.SURVEY_LINK || raw.surveyLink,
  formId: process.env.GOOGLE_FORM_ID || raw.formId,
  emailEntryId: process.env.SURVEY_EMAIL_ENTRY_ID || raw.emailEntryId,
  spreadsheetId: process.env.SPREADSHEET_ID || raw.spreadsheetId,
  followupDays: raw.followupDays || 4,
};

export const dataBackend = () => (process.env.DATA_BACKEND || "demo") as "demo" | "sheets";

/** Survey link with the person's email prefilled, so responses match reliably. */
export function prefilledSurveyLink(email: string): string {
  const base = config.surveyLink;
  if (!base || base.startsWith("[") || !config.emailEntryId || !email) return base;
  const url = base.replace(/\?.*$/, "");
  return `${url}?usp=pp_url&${config.emailEntryId}=${encodeURIComponent(email)}`;
}
