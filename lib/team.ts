// The team = everyone on ALLOWED_EMAILS. Tasks (assigned_to) and clients (owner) store a teammate's
// name, so the Sheet stays readable. A name can be given in ALLOWED_EMAILS ("Jamie Lee <jamie@x.com>");
// otherwise it's the first part of the email ("jamie.lee@x.com" → "Jamie"). Because names come from
// this list (not from signing in), work assigned to someone who hasn't signed in yet waits for them.

import { normEmail } from "@/lib/util";

export type Teammate = { name: string; email: string };

/** "Jamie Lee <jamie@x.com>" or "jamie@x.com" → { name, email } */
function parseEntry(entry: string): Teammate | null {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(entry);
  const email = normEmail(m ? m[2] : entry);
  if (!email.includes("@")) return null;
  return { name: (m && m[1]) || nameFromEmail(email), email };
}

export function nameFromEmail(email: string): string {
  const first = email.split("@")[0].split(/[._\-+0-9]+/).filter(Boolean)[0] || email;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Everyone on ALLOWED_EMAILS, in the order listed. */
export function team(): Teammate[] {
  const seen = new Set<string>();
  return (process.env.ALLOWED_EMAILS || "").split(",").map(parseEntry)
    .filter((t): t is Teammate => !!t && !seen.has(t.email) && !!seen.add(t.email));
}

export const teamEmails = () => team().map((t) => t.email);

/** Does a stored assigned_to / owner value refer to this person? Matches their name or email. */
export function isPerson(value: string | undefined, person: { name: string; email?: string }): boolean {
  const v = (value || "").trim().toLowerCase();
  if (!v) return false;
  return v === person.name.toLowerCase() || (!!person.email && v === person.email.toLowerCase());
}

/** The teammate a stored value refers to, if any. */
export function teammateFor(value: string, mates: Teammate[]): Teammate | undefined {
  return mates.find((t) => isPerson(value, t));
}
