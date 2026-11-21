// Business rules shared by the web app and the CLI (scripts/crm.ts).
// Every write records who made it (activity_log + updated_by / logged_by).

import { config } from "@/lib/config";
import { store, ONBOARDING_STEPS, RETENTION_SIGNALS, type Row, type TableName } from "@/lib/data";
import type { Step } from "@/lib/target";
import { ONBOARDING_STAGES, currentStage, enteredCol, stageByKey, stageIndex } from "@/lib/onboarding";
import { clientHealth } from "@/lib/retention";
import { addDays, isTrue, newId, nowStamp, today } from "@/lib/util";
import { isPerson, team } from "@/lib/team";
import { notify, taskEmailLines } from "@/lib/notify";

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
    organizations, sites, tasks, transcripts, stageHistory, activityLog] = await Promise.all([
    s.list("contacts"), s.list("interactions"), s.list("surveys"), s.list("interviews"),
    s.list("research_themes"), s.list("onboarding"), s.list("retention"), s.list("drafts"),
    s.list("email_templates"), s.list("interview_guides"), s.list("organizations"), s.list("sites"), s.list("tasks"),
    s.list("transcripts"), s.list("stage_history"), s.list("activity_log"),
  ]);
  return { contacts, interactions, surveys, interviews, themes, onboarding, retention, drafts, templates, guides,
    organizations, sites, tasks, transcripts, stageHistory, activityLog };
}
export type AllData = Awaited<ReturnType<typeof loadAll>>;

/**
 * One row per stage move (pipeline, research or onboarding), with who and when. The Insights page reads it.
 * If the Sheet doesn't have the stage_history tab yet (before setup-sheet), the move still happens and is
 * still in the activity log and timeline; only this extra row is skipped.
 */
export async function recordStageHistory(contactId: string, track: "pipeline" | "research" | "onboarding", from: string, to: string, actor: string) {
  try {
    await store().insert("stage_history", { id: newId("sh"), contact_id: contactId, track, from_stage: from || "", to_stage: to, at: nowStamp(), by: actor });
  } catch (err) {
    console.warn(`stage_history not saved (run setup-sheet to add the tab): ${(err as Error).message}`);
  }
}

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
  if (contact.stage) await recordStageHistory(contact.id, "pipeline", "", contact.stage, actor);
  if (contact.research_status) await recordStageHistory(contact.id, "research", "", contact.research_status, actor);
  await notifyClientAssigned(contact, actor);
  return contact;
}

async function notifyClientAssigned(c: Row, actor: string) {
  if (!c.owner) return;
  await notify({
    to: c.owner, type: "assign_client", by: actor, link: `/contacts/${c.id}`,
    eventKey: `assign:client:${c.id}:${c.owner}:${nowStamp()}`,
    title: `${actor} made you the owner of ${c.name}`,
    email: { subject: `You now own ${c.name}`, lines: [
      `${actor} made you the owner of ${c.name}${c.company ? ` (${c.company})` : ""}.`,
      `Stage: ${c.stage || c.research_status || "—"}`,
      c.next_followup_date ? `Next follow-up: ${formatDateShort(c.next_followup_date)}` : "",
    ].filter(Boolean) },
  });
}
const formatDateShort = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
  // Every stage change lands in stage_history, whichever path made it (board drag, outreach sent, import…).
  if (changes.stage !== undefined) await recordStageHistory(id, "pipeline", current.stage, changes.stage, actor);
  if (changes.research_status !== undefined) await recordStageHistory(id, "research", current.research_status, changes.research_status, actor);
  if (changes.owner !== undefined) {
    await logActivity(actor, "reassign", "contacts", id, `${actor} reassigned ${current.name} to ${changes.owner} (was ${current.owner || "no owner"})`);
    await notifyClientAssigned({ ...current, ...changes }, actor);
  }
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
  // New retention clients get a renewal date a year out (editable on the profile); the value defaults to the deal value.
  if (field === "stage" && value === "Active / Retention" && !c.renewal_date) patch.renewal_date = addDays(today(), 365);
  const saved = await updateContact(id, patch, actor);
  await logInteraction({
    contact_id: id, type: "note", channel: "other",
    summary: `${field === "stage" ? "Stage" : "Research status"}: ${c[field] || "—"} → ${value}${reason ? ` (${reason})` : ""}`,
  }, actor);
  if (field === "stage" && value === "Onboarding") await ensureOnboardingRow(id, actor);
  if (field === "stage" && value === "Active / Retention") await ensureRetentionRow(id, actor);
  await notify({
    to: c.owner, type: "stage_move", by: actor, link: `/contacts/${id}`, eventKey: `stage:${id}:${field}:${value}:${nowStamp()}`,
    title: `${actor} moved ${c.name} to ${value}`,
  });
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
  const first = ONBOARDING_STAGES[0];
  const row: Row = {
    id: newId("ob"), contact_id: contactId, start_date: today(), progress_pct: "0", health: "green",
    blockers: "", created_at: now, updated_at: now, updated_by: actor,
    onboarding_stage: first.key, [enteredCol(first.key)]: now,
  };
  await store().insert("onboarding", row);
  await logActivity(actor, "create", "onboarding", row.id, contactId);
  await recordStageHistory(contactId, "onboarding", "", first.key, actor);
  return row;
}

/**
 * Move a client to another onboarding stage (board drag or "Move to next stage").
 * Stamps when they entered it (for time-in-stage), and logs who moved them in the activity log,
 * the timeline and stage_history.
 */
export async function moveOnboardingStage(contactId: string, to: string, actor: string): Promise<Row> {
  const stage = stageByKey(to);
  if (!stage) throw new Error(`Unknown onboarding stage: ${to}`);
  const c = await getContact(contactId);
  if (!c) throw new Error("Contact not found");
  if (c.stage !== "Onboarding") throw new Error(`${c.name} isn't in Onboarding.`);
  const row = await ensureOnboardingRow(contactId, actor);
  const from = currentStage(row);
  if (from.key === to) return row;
  const now = nowStamp();
  const patch: Row = { onboarding_stage: to, [enteredCol(to)]: now, updated_at: now, updated_by: actor };
  const saved = await store().update("onboarding", row.id, patch);
  await logActivity(actor, "move", "onboarding", row.id, `${actor} moved ${c.name} from ${from.label} to ${stage.label}`);
  await recordStageHistory(contactId, "onboarding", from.key, to, actor);
  await logInteraction({ contact_id: contactId, type: "note", channel: "other", summary: `Onboarding: ${from.label} → ${stage.label}` }, actor);
  if (stageIndex(to) > stageIndex(from.key)) {
    await notify({
      to: c.owner, type: "stage_move", by: actor, link: `/onboarding/${contactId}`, eventKey: `onboarding:${contactId}:${to}:${now}`,
      title: `${actor} moved ${c.name} to ${stage.label}`,
    });
  }
  return saved;
}

/** Last onboarding stage done: stamp completed_at and move the client to Active / Retention. */
export async function completeOnboarding(contactId: string, actor: string) {
  const row = await ensureOnboardingRow(contactId, actor);
  const now = nowStamp();
  await store().update("onboarding", row.id, { completed_at: now, updated_at: now, updated_by: actor });
  await logActivity(actor, "complete", "onboarding", row.id, contactId);
  return moveStage(contactId, "stage", "Active / Retention", actor);
}

/**
 * Save each retention client's current health (calculated, or the manual override) to health_status,
 * so the Sheet shows it too. Run by the daily job and after an override changes. Only writes what changed.
 */
export async function refreshHealthStatuses(onlyId?: string) {
  const [contacts, interactions, tasks] = await Promise.all([store().list("contacts"), store().list("interactions"), store().list("tasks")]);
  let changed = 0;
  for (const c of contacts.filter((x) => x.stage === "Active / Retention" && (!onlyId || x.id === onlyId))) {
    const h = clientHealth(c, interactions, tasks).health;
    if (c.health_status !== h) { await store().update("contacts", c.id, { health_status: h }); changed++; }
  }
  return changed;
}

/** The client renewed: record when, and their next renewal date. */
export async function renewClient(contactId: string, nextDate: string, actor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate || "")) throw new Error("Pick the next renewal date.");
  const c = await getContact(contactId);
  if (!c) throw new Error("Contact not found");
  const saved = await updateContact(contactId, { last_renewed_at: nowStamp(), renewal_date: nextDate }, actor);
  await logInteraction({ contact_id: contactId, type: "note", channel: "other", summary: `Renewed · next renewal ${nextDate}` }, actor);
  return saved;
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
    id: newId("task"), title: input.title.trim(), due_date: input.due_date || "",
    // "" = Unassigned (chosen on purpose); left out entirely = the person creating it.
    assigned_to: input.assigned_to ?? actor,
    contact_id: input.contact_id || "", done: "", done_at: "", created_by: actor, created_at: now, updated_at: now,
    notes: input.notes || "", priority: input.priority === "Urgent" ? "Urgent" : "",
  };
  await store().insert("tasks", task);
  await logActivity(actor, "create", "tasks", task.id, `${actor} added task “${task.title}” for ${task.assigned_to || "Unassigned"}`);
  await notifyTask(task, actor, task.priority === "Urgent" ? "urgent_assign" : "assign");
  return task;
}

/** Tell the assignee about a task: assigned to them, and/or marked urgent. */
async function notifyTask(t: Row, actor: string, kind: "assign" | "urgent" | "urgent_assign") {
  if (!t.assigned_to) return;
  const client = t.contact_id ? (await getContact(t.contact_id))?.name || "" : "";
  const urgent = kind !== "assign";
  await notify({
    to: t.assigned_to, type: kind === "urgent" ? "urgent" : "assign_task", by: actor, link: "/tasks",
    eventKey: `${kind}:task:${t.id}:${t.assigned_to}:${nowStamp()}`,
    title: kind === "urgent" ? `${actor} marked urgent: ${t.title}` : `${actor} assigned you${urgent ? " an urgent task" : ""}: ${t.title}`,
    email: {
      subject: `${urgent ? "Urgent: " : "New task: "}${t.title}`,
      lines: taskEmailLines({ ...t, priority: urgent ? "Urgent" : t.priority }, client, actor, kind === "urgent" ? "marked this task urgent" : "assigned you a task"),
    },
  });
}

/** Edit a task. `done: "TRUE"` / `""` checks it off or reopens it. Reassigning is logged on its own. */
export async function updateTask(id: string, patch: Row, actor: string) {
  const current = (await store().list("tasks")).find((t) => t.id === id);
  if (!current) throw new Error("Task not found");
  const next: Row = { ...patch, updated_at: nowStamp() };
  // completed_at: when it was finished (for the Team page's Efficiency tab); done_at kept for older code and data.
  if (patch.done !== undefined) next.done_at = next.completed_at = isTrue(patch.done) ? nowStamp() : "";
  const saved = await store().update("tasks", id, next);
  const reassigned = patch.assigned_to !== undefined && patch.assigned_to !== current.assigned_to;
  if (reassigned) {
    await logActivity(actor, "reassign", "tasks", id, `${actor} reassigned task “${current.title}” to ${patch.assigned_to || "Unassigned"}`);
  }
  const other = Object.keys(patch).filter((k) => k !== "assigned_to" || !reassigned);
  if (other.length) {
    await logActivity(actor, patch.done !== undefined ? (isTrue(patch.done) ? "check" : "uncheck") : "update", "tasks", id, other.join(", "));
  }
  const nowUrgent = patch.priority === "Urgent" && current.priority !== "Urgent";
  if (!isTrue(saved.done) && (reassigned || nowUrgent)) {
    await notifyTask({ ...current, ...saved }, actor, reassigned && (nowUrgent || saved.priority === "Urgent") ? "urgent_assign" : reassigned ? "assign" : "urgent");
  }
  return saved;
}

/**
 * Hand off work from one person to another: the given open tasks and/or owned clients.
 * Each item is checked again here (it must still belong to `from`), moved, and logged.
 * `from` / `to` are teammate names; "" means Unassigned (tasks only — every client keeps an owner).
 */
export async function handOff(input: { from: string; to: string; taskIds?: string[]; contactIds?: string[] }, actor: string) {
  const { from, to } = input;
  if (from === to) throw new Error("Pick two different people.");
  // A stored value belongs to a person if it's their name, or their email when they're on the team list.
  const same = (v: string, who: string) => {
    if ((v || "").trim().toLowerCase() === who.trim().toLowerCase()) return true;
    const mate = who && team().find((t) => t.name.toLowerCase() === who.trim().toLowerCase());
    return !!mate && isPerson(v, mate);
  };
  const [tasks, contacts] = await Promise.all([store().list("tasks"), store().list("contacts")]);
  const moveTasks = tasks.filter((t) => input.taskIds?.includes(t.id) && !isTrue(t.done) && same(t.assigned_to, from));
  const moveClients = contacts.filter((c) => input.contactIds?.includes(c.id) && same(c.owner, from));
  if (moveClients.length && !to) throw new Error("Clients need an owner. Pick a person to move them to.");
  const label = (who: string) => who || "Unassigned";
  for (const t of moveTasks) {
    await store().update("tasks", t.id, { assigned_to: to, updated_at: nowStamp() });
    await logActivity(actor, "handoff", "tasks", t.id, `${actor} handed off task “${t.title}” from ${label(from)} to ${label(to)}`);
  }
  for (const c of moveClients) {
    await store().update("contacts", c.id, { owner: to, updated_at: nowStamp(), updated_by: actor });
    await logActivity(actor, "handoff", "contacts", c.id, `${actor} handed off ${c.name} from ${label(from)} to ${label(to)}`);
  }
  if (to && moveTasks.length + moveClients.length) {
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    const what = [moveTasks.length && n(moveTasks.length, "task"), moveClients.length && n(moveClients.length, "client")].filter(Boolean).join(" and ");
    await notify({
      to, type: "handoff", by: actor, link: "/tasks", eventKey: `handoff:${label(from)}:${to}:${nowStamp()}:${[...moveTasks, ...moveClients].map((x) => x.id).join(",")}`,
      title: `${actor} handed you ${what} from ${label(from)}`,
      email: { subject: `${actor} handed you ${what}`, lines: [
        `${actor} handed you ${what} from ${label(from)}:`,
        ...moveTasks.map((t) => `• Task: ${t.title}${t.due_date ? ` (due ${formatDateShort(t.due_date)})` : ""}`),
        ...moveClients.map((c) => `• Client: ${c.name}${c.company ? ` (${c.company})` : ""}`),
      ] },
    });
  }
  return { tasks: moveTasks.length, clients: moveClients.length };
}

/**
 * Reassign several tasks (or clients) to one person at once, from the Team page.
 * Each item is logged like a single reassignment (activity log + the client's timeline), but the new assignee gets
 * ONE notification listing everything, sent through notify() so the usual rules apply (allowlist, settings, caps).
 * `to` = "" means Unassigned (tasks only; every client keeps an owner).
 */
export async function bulkReassign(input: { kind: "tasks" | "clients"; ids: string[]; to: string }, actor: string) {
  const { kind, ids, to } = input;
  if (!ids.length) throw new Error("Nothing selected.");
  const label = to || "Unassigned";
  const lines: string[] = [];
  let moved = 0;
  if (kind === "tasks") {
    const [tasks, contacts] = await Promise.all([store().list("tasks"), store().list("contacts")]);
    const names = new Map(contacts.map((c) => [c.id, c.name]));
    for (const t of tasks.filter((x) => ids.includes(x.id) && !isTrue(x.done) && x.assigned_to !== to)) {
      await store().update("tasks", t.id, { assigned_to: to, updated_at: nowStamp() });
      await logActivity(actor, "reassign", "tasks", t.id, `${actor} reassigned task “${t.title}” to ${label} (was ${t.assigned_to || "Unassigned"})`);
      lines.push(`• ${t.title}${names.get(t.contact_id) ? ` (${names.get(t.contact_id)})` : ""}${t.due_date ? `, due ${formatDateShort(t.due_date)}` : ""}`);
      moved++;
    }
  } else {
    if (!to) throw new Error("Clients need an owner. Pick a person.");
    for (const c of (await store().list("contacts")).filter((x) => ids.includes(x.id) && x.owner !== to)) {
      await store().update("contacts", c.id, { owner: to, updated_at: nowStamp(), updated_by: actor });
      await logActivity(actor, "reassign", "contacts", c.id, `${actor} reassigned ${c.name} to ${to} (was ${c.owner || "no owner"})`);
      lines.push(`• ${c.name}${c.company ? ` (${c.company})` : ""}`);
      moved++;
    }
  }
  if (to && moved) {
    const what = `${moved} ${kind === "tasks" ? "task" : "client"}${moved === 1 ? "" : "s"}`;
    await notify({
      to, type: kind === "tasks" ? "assign_task" : "assign_client", by: actor, link: kind === "tasks" ? "/tasks" : "/team?view=clients",
      eventKey: `bulk:${kind}:${to}:${nowStamp()}:${ids.join(",")}`,
      title: `${actor} assigned you ${what}`,
      email: { subject: `${actor} assigned you ${what}`, lines: [`${actor} assigned you ${what}:`, ...lines] },
    });
  }
  return { moved };
}

/** Reassignment and hand-off entries for one client: their own, plus those on their tasks. Newest first. */
export async function ownershipHistory(contactId: string): Promise<Row[]> {
  const [log, tasks] = await Promise.all([store().list("activity_log"), store().list("tasks")]);
  const taskIds = new Set(tasks.filter((t) => t.contact_id === contactId).map((t) => t.id));
  return log
    .filter((l) => ["reassign", "handoff"].includes(l.action)
      && ((l.table === "contacts" && l.record_id === contactId) || (l.table === "tasks" && taskIds.has(l.record_id))))
    .sort((a, b) => b.at.localeCompare(a.at));
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
