import { normEmail } from "@/lib/util";
import type { RawSurveyResponse } from "./types";

// Turns the Google Form response tab (header row = questions) into structured responses.
// Email priority: the prefilled "email" question, then Google's collected "Email Address".
export function parseRawSurveyRows(values: string[][]): RawSurveyResponse[] {
  const headers = (values[0] || []).map((h) => String(h).trim());
  const tsCol = headers.findIndex((h) => /^timestamp$/i.test(h));
  const collected = headers.findIndex((h) => /^email address$/i.test(h));
  const prefilled = headers.findIndex((h, i) => i !== collected && /email/i.test(h));
  return values
    .slice(1)
    .map((line) => {
      const get = (c: number) => (c >= 0 && line[c] != null ? String(line[c]).trim() : "");
      const email = normEmail(get(prefilled) || get(collected));
      const timestamp = get(tsCol);
      const answers = headers
        .map((question, c) => ({ question, answer: get(c) }))
        .filter((a, c) => c !== tsCol && c !== collected && c !== prefilled && a.answer);
      // Stable key: survives rows being sorted or deleted in the Sheet.
      return { key: `${timestamp}|${email}`, timestamp, email, answers };
    })
    .filter((r) => r.timestamp || r.email);
}
