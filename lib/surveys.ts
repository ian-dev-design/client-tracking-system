// Match Google Form responses to contacts by email and record them.

import { aiSurveyTakeaways } from "@/lib/ai";
import { createContact, getContact, isProspect, isResearch, logInteraction, updateContact, logActivity } from "@/lib/crm";
import { store, type RawSurveyResponse, type Row } from "@/lib/data";
import { newId, normEmail, nowStamp, today } from "@/lib/util";

const formatAnswers = (r: RawSurveyResponse) => r.answers.map((a) => `${a.question}\n→ ${a.answer}`).join("\n\n");

async function state() {
  const s = store();
  const [raw, surveys, contacts, interactions] = await Promise.all([
    s.listRawSurveyResponses(), s.list("surveys"), s.list("contacts"), s.list("interactions"),
  ]);
  const done = new Set(surveys.map((sv) => sv.raw_key).filter(Boolean));
  const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [normEmail(c.email), c]));
  return { raw, done, byEmail, interactions };
}

/** Save one response against a contact and move them forward. Never modifies the raw response. */
async function record(r: RawSurveyResponse, contact: Row, interactions: Row[], actor: string) {
  const responses = formatAnswers(r);
  const sent = interactions
    .filter((i) => i.contact_id === contact.id && (i.type === "email" || i.type === "text"))
    .map((i) => i.date).sort().pop() || "";
  const now = nowStamp();
  const completed = (r.timestamp || today()).slice(0, 10);
  const row: Row = {
    id: newId("sv"), contact_id: contact.id, date_sent: sent, date_completed: completed,
    responses, key_takeaways: await aiSurveyTakeaways(responses), raw_key: r.key,
    created_at: now, updated_at: now, updated_by: actor,
  };
  await store().insert("surveys", row);
  await logActivity(actor, "create", "surveys", row.id, contact.id);
  await logInteraction({ contact_id: contact.id, type: "survey", channel: "other", date: completed, summary: "Completed the survey" }, actor);
  const patch: Row = {};
  if (isProspect(contact) && ["", "Lead", "Outreach"].includes(contact.stage)) patch.stage = "Survey Completed";
  if (isResearch(contact) && ["", "To Contact", "Contacted"].includes(contact.research_status)) patch.research_status = "Survey Completed";
  if (Object.keys(patch).length) await updateContact(contact.id, patch, actor);
}

/** Process every new response that matches a contact. Returns counts. */
export async function syncSurveys(actor: string) {
  const { raw, done, byEmail, interactions } = await state();
  let matched = 0;
  let unmatched = 0;
  for (const r of raw) {
    if (done.has(r.key)) continue;
    const contact = byEmail.get(r.email);
    if (!contact) { unmatched++; continue; }
    await record(r, contact, interactions, actor);
    done.add(r.key);
    matched++;
  }
  return { matched, unmatched };
}

export async function listUnmatched(): Promise<RawSurveyResponse[]> {
  const { raw, done, byEmail } = await state();
  return raw.filter((r) => !done.has(r.key) && !byEmail.get(r.email));
}

export async function linkResponse(key: string, contactId: string, actor: string) {
  const { raw, done, interactions } = await state();
  const r = raw.find((x) => x.key === key);
  if (!r || done.has(key)) throw new Error("Response not found or already linked");
  const contact = await getContact(contactId);
  if (!contact) throw new Error("Contact not found");
  if (!contact.email && r.email) await updateContact(contact.id, { email: r.email }, actor);
  await record(r, contact, interactions, actor);
}

export async function createContactFromResponse(key: string, actor: string) {
  const { raw } = await state();
  const r = raw.find((x) => x.key === key);
  if (!r) throw new Error("Response not found");
  const find = (re: RegExp) => r.answers.find((a) => re.test(a.question))?.answer || "";
  const contact = await createContact({
    name: r.email.split("@")[0] || "New contact", email: r.email,
    role: find(/role/i), company: find(/(company|organization).*work for/i), source: "Survey", contact_type: "prospect",
  }, actor);
  await linkResponse(key, contact.id, actor);
  return contact;
}
