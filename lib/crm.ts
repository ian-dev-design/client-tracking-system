// Business rules shared by the web app and the CLI (scripts/crm.ts).
// Every write records who made it (activity_log + updated_by / logged_by).

import { config } from "@/lib/config";
import { store, ONBOARDING_STEPS, RETENTION_SIGNALS, type Row, type TableName } from "@/lib/data";
import type { Step } from "@/lib/target";
import { addDays, isTrue, newId, nowStamp, today } from "@/lib/util";

export type Contact = Row;

const followupDate = () => addDays(today(), config.followupDays);

export async function logActivity(user: string, action: string, table: TableName, recordId: string, details = "") {
  await store().insert("activity_log", {
    id: newId("log"), at: nowStamp(), user, action, table, record_id: recordId, details,
  });
}

/** Everything the pages need, loaded in parallel. */
export async function loadAll() {
  const s = store();
  const [contacts, interactions, surveys, interviews, themes, onboarding, retention, drafts, templates, guides,
    organizations, sites, tasks, transcripts] = await Promise.all([
    s.list("contacts"), s.list("interactions"), s.list("surveys"), s.list("interviews"),
    s.list("research_themes"), s.list("onboarding"), s.list("retention"), s.list("drafts"),
    s.list("email_templates"), s.list("interview_guides"), s.list("organizations"), s.list("sites"), s.list("tasks"),
    s.list("transcripts"),
  ]);
  return { contacts, interactions, surveys, interviews, themes, onboarding, retention, drafts, templates, guides,
    organizations, sites, tasks, transcripts };
}
export type AllData = Awaited<ReturnType<typeof loadAll>>;

export async function getContact(id: string): Promise<Contact | undefined> {
  return (await store().list("contacts")).find((c) => c.id === id);
}

export const isProspect = (c: Contact) => c.contact_type === "prospect" || c.contact_type === "both";
export const isResearch = (c: Contact) => c.contact_type === "research_participant" || c.contact_type === "both";
export const isClosed = (c: Contact) =>
  c.stage === "Churned / Lost" || (!isProspect(c) && c.research_status === "Done");

/** Fill required defaults so every contact has an owner and a follow-up date. */
function withDefaults(c: Contact, actor: string): Contact {
  const out = { ...c };
  if (!out.contact_type) out.contact_type = "prospect";
  if (isProspect(out) && !out.stage) out.stage = "Lead";
  if (isResearch(out) && !out.research_status) out.research_status = "To Contact";
  if (!out.owner) out.owner = actor;
  if (!isClosed(out) && !out.next_followup_date) out.next_followup_date = followupDate();
  return out;
}

export async function createContact(input: Row, actor: string): Promise<Contact> {
  if (!input.name?.trim()) throw new Error("Name is required");
  const now = nowStamp();
  const contact = withDefaults(
    { ...(await linkOrganization(input, actor)), id: newId("c"), created_at: now, updated_at: now, updated_by: actor },
    actor,
  );
  await store().insert("contacts", contact);
  await logActivity(actor, "create", "contacts", contact.id, contact.name);
  return contact;
}

export async function updateContact(id: string, patch: Row, actor: string): Promise<Contact> {
  const current = await getContact(id);
  if (!current) throw new Error("Contact not found");
  if (patch.company !== undefined && patch.company !== current.company) patch = await linkOrganization(patch, actor);
  const next = withDefaults({ ...current, ...patch }, actor);
  const changes: Row = {};
  for (const k of Object.keys(next)) if (next[k] !== current[k]) changes[k] = next[k];
  if (!Object.keys(changes).length) return current;
  changes.updated_at = nowStamp();
  changes.updated_by = actor;
  const saved = await store().update("contacts", id, changes);
  await logActivity(actor, "update", "contacts", id, Object.keys(changes).filter((k) => !k.startsWith("updated")).join(", "));
  return saved;
}

/**
 * Change pipeline stage (or research status) and leave a note in the timeline saying who moved it.
 * - Moving to "Churned / Lost" requires a reason.
 * - Giving a research-only participant a pipeline stage makes them a prospect too.
 * - Moving into Onboarding creates their onboarding checklist if they don't have one.
 * - Moving into Active / Retention creates their retention-signals row if they don't have one.
 * - Onboarding / Active marks the deal won; Churned / Lost before that marks it lost.
 */
export async function moveStage(id: string, field: "stage" | "research_status", value: string, actor: string, reason = "") {
  const c = await getContact(id);
  if (!c) throw new Error("Contact not found");
  if (c[field] === value) return c;
  if (value === "Churned / Lost" && !reason.trim()) throw new Error("A reason is required to mark someone as churned / lost.");
  const patch: Row = { [field]: value };
  if (value === "Churned / Lost") patch.lost_reason = reason.trim();
  if (field === "stage" && c.contact_type === "research_participant") patch.contact_type = "both";
  // The deal is won once they start onboarding; lost if they drop out before that.
  if (field === "stage" && ["Onboarding", "Active / Retention"].includes(value) && c.deal_status !== "won") patch.deal_status = "won";
  if (field === "stage" && value === "Churned / Lost" && c.deal_status !== "won") patch.deal_status = "lost";
  const saved = await updateContact(id, patch, actor);
  await logInteraction({
    contact_id: id, type: "note", channel: "other",
    summary: `${field === "stage" ? "Stage" : "Research status"}: ${c[field] || "—"} → ${value}${reason ? ` (${reason})` : ""}`,
  }, actor);
  if (field === "stage" && value === "Onboarding") await ensureOnboardingRow(id, actor);
  if (field === "stage" && value === "Active / Retention") await ensureRetentionRow(id, actor);
  return saved;
}

export async function logInteraction(input: Row, actor: string): Promise<Row> {
  if (!input.contact_id) throw new Error("contact_id is required");
  const row: Row = {
    id: newId("int"), date: input.date || today(), type: input.type || "note", channel: input.channel || "other",
    summary: input.summary || "", email_subject: input.email_subject || "", email_body: input.email_body || "",
    contact_id: input.contact_id, logged_by: actor, created_at: nowStamp(),
  };
  await store().insert("interactions", row);
  await logActivity(actor, "log_interaction", "interactions", row.id, `${row.type} via ${row.channel}`);
  return row;
}

/** After a message goes out (Gmail send or "Mark as sent"): log it, advance the stage, set follow-up. */
export async function recordOutreachSent(
  opts: { contactId: string; channel: string; subject?: string; body: string; draftId?: string },
  actor: string,
) {
  const c = await getContact(opts.contactId);
  if (!c) throw new Error("Contact not found");
  await logInteraction({
    contact_id: c.id,
    type: opts.channel === "gmail" ? "email" : "text",
    channel: opts.channel,
    summary: opts.subject ? `Sent: ${opts.subject}` : `Sent message via ${opts.channel}`,
    email_subject: opts.subject || "",
    email_body: opts.body,
  }, actor);
  const patch: Row = { next_followup_date: followupDate() };
  if (isProspect(c) && c.stage === "Lead") patch.stage = "Outreach";
  if (isResearch(c) && c.research_status === "To Contact") patch.research_status = "Contacted";
  await updateContact(c.id, patch, actor);
  if (opts.draftId) await updateDraft(opts.draftId, { status: "sent" }, actor);
}

// ---------- Drafts ----------

export async function saveDraft(input: Row, actor: string): Promise<Row> {
  const now = nowStamp();
  const row: Row = {
    id: newId("d"), contact_id: input.contact_id, template: input.template || "",
    subject: input.subject || "", body: input.body || "", short_body: input.short_body || "",
    status: "pending", created_by: actor, created_at: now, updated_at: now,
  };
  await store().insert("drafts", row);
  await logActivity(actor, "create_draft", "drafts", row.id, input.contact_id);
  return row;
}

export async function updateDraft(id: string, patch: Row, actor: string) {
  const saved = await store().update("drafts", id, { ...patch, updated_at: nowStamp() });
  await logActivity(actor, "update_draft", "drafts", id, Object.keys(patch).join(", "));
  return saved;
}

// ---------- Onboarding ----------

/** Percent of steps checked. */
export function checklistProgress(row: Row, steps: Step[] = ONBOARDING_STEPS): number {
  const done = steps.filter((s) => isTrue(row[s.key])).length;
  return steps.length ? Math.round((done / steps.length) * 100) : 0;
}
export const onboardingProgress = (row: Row) => checklistProgress(row, ONBOARDING_STEPS);

/** Check / uncheck one item on an onboarding checklist or retention signal list, stamping today's date. */
async function toggleChecklist(table: "onboarding" | "retention", steps: Step[], id: string, key: string, actor: string) {
  if (!steps.some((s) => s.key === key)) throw new Error(`Unknown item: ${key}`);
  const row = (await store().list(table)).find((r) => r.id === id);
  if (!row) throw new Error(`${table} row not found`);
  const on = !isTrue(row[key]);
  const patch: Row = { [key]: on ? "TRUE" : "", [`${key}_date`]: on ? today() : "", updated_at: nowStamp(), updated_by: actor };
  if (table === "onboarding") patch.progress_pct = String(checklistProgress({ ...row, ...patch }, steps));
  await store().update(table, id, patch);
  await logActivity(actor, on ? "check" : "uncheck", table, id, key);
}

export const toggleOnboardingStep = (id: string, step: string, actor: string) =>
  toggleChecklist("onboarding", ONBOARDING_STEPS, id, step, actor);

export const toggleRetentionSignal = (id: string, signal: string, actor: string) =>
  toggleChecklist("retention", RETENTION_SIGNALS, id, signal, actor);

export async function updateOnboarding(id: string, patch: Row, actor: string) {
  await store().update("onboarding", id, { ...patch, updated_at: nowStamp(), updated_by: actor });
  await logActivity(actor, "update", "onboarding", id, Object.keys(patch).join(", "));
}

/** The contact's onboarding checklist, created (all steps unchecked) if missing. */
export async function ensureOnboardingRow(contactId: string, actor: string): Promise<Row> {
  const existing = (await store().list("onboarding")).find((r) => r.contact_id === contactId);
  if (existing) return existing;
  const now = nowStamp();
  const row: Row = {
    id: newId("ob"), contact_id: contactId, start_date: today(), progress_pct: "0", health: "green",
    blockers: "", created_at: now, updated_at: now, updated_by: actor,
  };
  await store().insert("onboarding", row);
  await logActivity(actor, "create", "onboarding", row.id, contactId);
  return row;
}

/** The customer's retention-signals row, created (nothing checked) if missing. */
export async function ensureRetentionRow(contactId: string, actor: string): Promise<Row> {
  const existing = (await store().list("retention")).find((r) => r.contact_id === contactId);
  if (existing) return existing;
  const now = nowStamp();
  const row: Row = { id: newId("rt"), contact_id: contactId, active_since: today(), notes: "", created_at: now, updated_at: now, updated_by: actor };
  await store().insert("retention", row);
  await logActivity(actor, "create", "retention", row.id, contactId);
  return row;
}

export async function updateRetention(id: string, patch: Row, actor: string) {
  await store().update("retention", id, { ...patch, updated_at: nowStamp(), updated_by: actor });
  await logActivity(actor, "update", "retention", id, Object.keys(patch).join(", "));
}

/** Move to Onboarding (creates the checklist). The welcome draft is added by lib/outreach.ts or /start-onboarding. */
export async function startOnboarding(contactId: string, actor: string): Promise<Row> {
  await moveStage(contactId, "stage", "Onboarding", actor);
  return ensureOnboardingRow(contactId, actor);
}

/** Research participant → prospect. Keeps research history (type becomes "both"). */
export async function convertToProspect(contactId: string, actor: string) {
  const c = await getContact(contactId);
  if (!c) throw new Error("Contact not found");
  const saved = await updateContact(contactId, { contact_type: "both", stage: c.stage || "Lead" }, actor);
  await logInteraction({ contact_id: contactId, type: "note", channel: "other", summary: "Converted to prospect" }, actor);
  return saved;
}

// ---------- Organizations & sites ----------

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Find an organization by name (case-insensitive), or create it. */
export async function ensureOrganization(name: string, actor: string, extra: Row = {}): Promise<Row> {
  const existing = (await store().list("organizations")).find((o) => sameName(o.name, name));
  if (existing) return existing;
  const now = nowStamp();
  const org: Row = { id: newId("org"), name: name.trim(), type: "", address: "", notes: "", ...extra, created_at: now, updated_at: now, updated_by: actor };
  await store().insert("organizations", org);
  await logActivity(actor, "create", "organizations", org.id, org.name);
  return org;
}

/** Keep `company` (display name) and `organization_id` in step: typing an organization name links or creates it. */
async function linkOrganization(input: Row, actor: string): Promise<Row> {
  const out = { ...input };
  if (out.company?.trim()) {
    const org = await ensureOrganization(out.company, actor);
    out.organization_id = org.id;
    out.company = org.name;
  } else if (out.organization_id) {
    const org = (await store().list("organizations")).find((o) => o.id === out.organization_id);
    if (org) out.company = org.name;
  } else if (out.company !== undefined) {
    out.organization_id = "";
  }
  return out;
}

export async function updateOrganization(id: string, patch: Row, actor: string) {
  const saved = await store().update("organizations", id, { ...patch, updated_at: nowStamp(), updated_by: actor });
  if (patch.name) {
    // keep each contact's display name in step with a renamed organization
    for (const c of (await store().list("contacts")).filter((x) => x.organization_id === id)) {
      if (c.company !== patch.name) await store().update("contacts", c.id, { company: patch.name });
    }
  }
  await logActivity(actor, "update", "organizations", id, Object.keys(patch).join(", "));
  return saved;
}

export async function addSite(input: Row, actor: string): Promise<Row> {
  if (!input.organization_id) throw new Error("A site needs an organization");
  if (!input.name?.trim()) throw new Error("Site name is required");
  const now = nowStamp();
  const site: Row = { ...input, id: newId("site"), status: input.status || "Prospect", created_at: now, updated_at: now, updated_by: actor };
  await store().insert("sites", site);
  await logActivity(actor, "create", "sites", site.id, site.name);
  return site;
}

export async function updateSite(id: string, patch: Row, actor: string) {
  const saved = await store().update("sites", id, { ...patch, updated_at: nowStamp(), updated_by: actor });
  await logActivity(actor, "update", "sites", id, Object.keys(patch).join(", "));
  return saved;
}

// ---------- Tasks ----------

export async function addTask(input: Row, actor: string): Promise<Row> {
  if (!input.title?.trim()) throw new Error("Task title is required");
  const now = nowStamp();
  const task: Row = {
    id: newId("task"), title: input.title.trim(), due_date: input.due_date || "", assigned_to: input.assigned_to || actor,
    contact_id: input.contact_id || "", done: "", done_at: "", created_by: actor, created_at: now, updated_at: now,
  };
  await store().insert("tasks", task);
  await logActivity(actor, "create", "tasks", task.id, `${task.title} → ${task.assigned_to}`);
  return task;
}

/** Edit a task. `done: "TRUE"` / `""` checks it off or reopens it. */
export async function updateTask(id: string, patch: Row, actor: string) {
  const next: Row = { ...patch, updated_at: nowStamp() };
  if (patch.done !== undefined) next.done_at = isTrue(patch.done) ? nowStamp() : "";
  const saved = await store().update("tasks", id, next);
  await logActivity(actor, patch.done !== undefined ? (isTrue(patch.done) ? "check" : "uncheck") : "update", "tasks", id, Object.keys(patch).join(", "));
  return saved;
}

// ---------- Transcripts ----------

const PART_SIZE = 40_000; // stays under the Sheets 50,000-character cell limit

/** Store an interview's transcript exactly as given (never edited), split into parts if it's long. */
export async function saveTranscriptText(interviewId: string, text: string, actor: string) {
  if (!text.trim()) return;
  const now = nowStamp();
  for (let i = 0, part = 1; i < text.length; i += PART_SIZE, part++) {
    await store().insert("transcripts", { id: newId("tr"), interview_id: interviewId, part: String(part), text: text.slice(i, i + PART_SIZE), created_at: now });
  }
  await logActivity(actor, "create", "transcripts", interviewId, `${text.length} characters`);
}

/** The full transcript for an interview ("" if none), parts joined back together. */
export function transcriptFor(interviewId: string, transcripts: Row[]): string {
  return transcripts.filter((t) => t.interview_id === interviewId)
    .sort((a, b) => Number(a.part) - Number(b.part)).map((t) => t.text).join("");
}

// ---------- Interviews ----------

export async function addInterview(input: Row, actor: string): Promise<Row> {
  const now = nowStamp();
  const row: Row = {
    ...input, id: newId("iv"), extraction_status: input.extraction_status || "pending",
    created_at: now, updated_at: now, updated_by: actor,
  };
  await store().insert("interviews", row);
  await logActivity(actor, "create", "interviews", row.id, input.contact_id);
  await logInteraction({
    contact_id: input.contact_id, type: "interview", channel: "other", date: input.date,
    summary: `Interview added (${input.purpose || "research"})`,
  }, actor);
  return row;
}

export async function updateInterview(id: string, patch: Row, actor: string) {
  await store().update("interviews", id, { ...patch, updated_at: nowStamp(), updated_by: actor });
  await logActivity(actor, "update", "interviews", id, Object.keys(patch).join(", "));
}

/** Generic upsert for small tables the commands manage (themes, guides, templates). */
export async function upsertByField(table: TableName, field: string, row: Row, actor: string) {
  const existing = (await store().list(table)).find((r) => r[field] === row[field]);
  if (existing) {
    await store().update(table, existing.id, row);
    await logActivity(actor, "update", table, existing.id, row[field]);
    return { ...existing, ...row };
  }
  const inserted = { ...row, id: newId(table.slice(0, 3)) };
  await store().insert(table, inserted);
  await logActivity(actor, "create", table, inserted.id, row[field]);
  return inserted;
}
