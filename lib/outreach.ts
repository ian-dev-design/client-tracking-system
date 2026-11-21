// Build an outreach draft for a contact: a saved pending draft if one exists,
// otherwise the right email template filled with the contact's info
// (personalized by Claude only when ANTHROPIC_API_KEY is set).

import { aiEnabled, aiPersonalizeDraft } from "@/lib/ai";
import { getContact, isProspect, isResearch, saveDraft, startOnboarding, updateOnboarding } from "@/lib/crm";
import { prefilledSurveyLink } from "@/lib/config";
import { store, type Row } from "@/lib/data";
import { fillTemplate, firstName } from "@/lib/util";

export function suggestedPurpose(c: Row): string {
  if (isProspect(c)) {
    if (c.stage === "Outreach") return "followup";
    if (c.stage === "Survey Completed") return "interview_request";
    if (c.stage === "Onboarding") return "welcome";
    if (c.contact_type === "prospect") return "outreach_prospect";
  }
  if (isResearch(c)) {
    if (c.research_status === "Contacted") return "followup";
    if (c.research_status === "Survey Completed") return "interview_request";
    return "outreach_research";
  }
  return "outreach_prospect";
}

export type Draft = {
  draftId?: string; contactId: string; to: string; name: string;
  template: string; subject: string; body: string; short_body: string; source: "saved" | "template" | "ai";
};

export async function buildDraft(contactId: string, senderName: string, purpose?: string): Promise<Draft> {
  const c = await getContact(contactId);
  if (!c) throw new Error("Contact not found");
  const base = { contactId, to: c.email, name: c.name };

  if (!purpose) {
    const saved = (await store().list("drafts"))
      .filter((d) => d.contact_id === contactId && d.status === "pending")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (saved) {
      return { ...base, draftId: saved.id, template: saved.template, subject: saved.subject,
        body: saved.body, short_body: saved.short_body, source: "saved" };
    }
  }

  const want = purpose || suggestedPurpose(c);
  const templates = await store().list("email_templates");
  const tpl = templates.find((t) => t.purpose === want) || templates[0];
  if (!tpl) throw new Error("No email templates found — run /setup-sheet");

  const surveyLink = prefilledSurveyLink(c.email);
  const vars = {
    first_name: firstName(c.name), name: c.name, company: c.company || "your team",
    role: c.role || "", survey_link: surveyLink, sender_name: senderName,
  };
  const filled = {
    subject: fillTemplate(tpl.subject, vars),
    body: fillTemplate(tpl.body, vars),
    short_body: fillTemplate(tpl.short_body, vars),
  };

  if (aiEnabled()) {
    const ai = await aiPersonalizeDraft({
      contact: { name: c.name, company: c.company, role: c.role, notes: c.notes, stage: c.stage },
      template: filled, research: c.contact_type === "research_participant", senderName, surveyLink,
    });
    if (ai) return { ...base, template: tpl.purpose, ...ai, source: "ai" };
  }
  return { ...base, template: tpl.purpose, ...filled, source: "template" };
}

/**
 * "Move to Onboarding" in the app: same steps as /start-onboarding.
 * Sets the stage, creates the checklist, logs it, and saves a welcome email as a draft to review.
 * Never sends anything.
 */
export async function moveToOnboarding(contactId: string, actor: string, handoffNotes = "") {
  const row = await startOnboarding(contactId, actor);
  // What sales / outreach learned, written at the moment of the move.
  if (handoffNotes.trim() && !row.handoff_notes) await updateOnboarding(row.id, { handoff_notes: handoffNotes.trim() }, actor);
  const drafts = await store().list("drafts");
  const hasWelcome = drafts.some((d) => d.contact_id === contactId && d.status === "pending" && d.template === "welcome");
  if (!hasWelcome) {
    const d = await buildDraft(contactId, actor, "welcome");
    await saveDraft({ contact_id: contactId, template: d.template, subject: d.subject, body: d.body, short_body: d.short_body }, actor);
  }
  return row;
}
