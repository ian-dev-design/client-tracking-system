// The single source of truth for tabs (tables) and their columns.
// The Sheet's header row must match these names; setup-sheet creates them.
// Onboarding and retention columns come from the steps / signals in config.json.

import { ONBOARDING_STAGES, ONBOARDING_STEPS, RETENTION_SIGNALS, type Step } from "@/lib/target";

const checklistColumns = (steps: Step[]) => steps.flatMap((s) => [s.key, `${s.key}_date`]);

export const TABLES = {
  contacts: [
    "id", "name", "company", "role", "email", "phone", "linkedin", "source",
    "contact_type", "stage", "research_status", "owner", "fit_score",
    "next_followup_date", "notes", "lost_reason",
    "organization_id", // links to organizations; `company` keeps the organization's name for display
    "quote_amount", "deal_value", "expected_close_date", "deal_status", // deal_status: open | won | lost
    "created_at", "updated_at", "updated_by",
    // Retention: renewal_value blank = the deal value. health_override: green | yellow | red, blank = calculated.
    "renewal_date", "renewal_value", "last_renewed_at", "health_override",
  ],
  organizations: ["id", "name", "type", "address", "notes", "created_at", "updated_at", "updated_by"],
  sites: [
    "id", "organization_id", "name", "address", "size", "notes", // size/notes labels come from config.json → sites
    "service_start", "service_end", "status", "created_at", "updated_at", "updated_by",
  ],
  tasks: ["id", "title", "due_date", "assigned_to", "contact_id", "done", "done_at", "created_by", "created_at", "updated_at", "notes", "priority"],
  // Full interview transcripts, word for word. Long ones are split into parts (a Sheet cell holds ~50k characters).
  transcripts: ["id", "interview_id", "part", "text", "created_at"],
  interactions: [
    "id", "contact_id", "date", "type", "channel", "summary", "email_subject", "email_body",
    "logged_by", "created_at",
  ],
  surveys: [
    "id", "contact_id", "date_sent", "date_completed", "responses", "key_takeaways",
    "raw_key", "created_at", "updated_at", "updated_by",
  ],
  interviews: [
    "id", "contact_id", "date", "interviewer", "purpose", "transcript_link", "summary",
    "pain_points", "current_tools", "workflow", "willingness_to_pay", "key_quotes", "themes",
    "surprises", "follow_up_actions", "extraction_status", "created_at", "updated_at", "updated_by",
  ],
  research_themes: [
    "id", "theme", "description", "interview_count", "linked_interview_ids", "example_quotes",
    "last_updated",
  ],
  interview_guides: ["id", "name", "purpose", "questions", "last_updated"],
  email_templates: ["id", "name", "purpose", "subject", "body", "short_body", "last_updated"],
  onboarding: [
    "id", "contact_id", "start_date", ...checklistColumns(ONBOARDING_STEPS),
    "progress_pct", "health", "blockers", "created_at", "updated_at", "updated_by",
    // onboarding_stage = a stage key from config.json; <stage>_entered_at = when they last entered it.
    "onboarding_stage", "handoff_notes", "success_goals", ...ONBOARDING_STAGES.map((s) => `${s.key}_entered_at`), "completed_at",
  ],
  retention: [
    "id", "contact_id", "active_since", ...checklistColumns(RETENTION_SIGNALS),
    "notes", "created_at", "updated_at", "updated_by",
  ],
  drafts: [
    "id", "contact_id", "template", "subject", "body", "short_body", "status",
    "created_by", "created_at", "updated_at",
  ],
  activity_log: ["id", "at", "user", "action", "table", "record_id", "details"],
  // Every stage move, for the Insights page. track: pipeline | research | onboarding.
  stage_history: ["id", "contact_id", "track", "from_stage", "to_stage", "at", "by"],
  // In-app notifications for teammates (the bell). event_key stops the same event notifying twice.
  notifications: ["id", "to", "type", "title", "link", "by", "event_key", "read", "emailed_at", "created_at"],
  // One row per teammate; no row = everything on. digest_day: Mon..Sun.
  notification_settings: ["id", "email", "assign_email", "urgent_email", "digest_email", "digest_day", "updated_at"],
};

export type TableName = keyof typeof TABLES;
export type Row = Record<string, string>;

// survey_responses_raw is owned by Google Forms (its columns are the questions),
// so it is read-only and not listed above.
export const RAW_SURVEY_TAB = "survey_responses_raw";

export const PIPELINE_STAGES = [
  "Lead",
  "Outreach",
  "Survey Completed",
  "Client Interview",
  "Qualified",
  "Onboarding",
  "Active / Retention",
  "Churned / Lost",
] as const;

export const BOARD_STAGES = PIPELINE_STAGES.slice(0, 5);

export const RESEARCH_STATUSES = [
  "To Contact",
  "Contacted",
  "Survey Completed",
  "Interview Scheduled",
  "Interviewed",
  "Done",
] as const;

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export { SITE_CONFIG } from "@/lib/target";

export const CONTACT_TYPES = ["prospect", "research_participant", "both"] as const;
export const INTERACTION_TYPES = ["email", "text", "survey", "call", "interview", "meeting", "note"] as const;
export const CHANNELS = ["gmail", "linkedin", "imessage", "other"] as const;
export const INTERVIEW_PURPOSES = ["research", "sales_discovery", "both"] as const;
export const TEMPLATE_PURPOSES = [
  "outreach_prospect", "outreach_research", "followup", "interview_request", "welcome",
] as const;
export { ONBOARDING_STEPS, RETENTION_SIGNALS };
