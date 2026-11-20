# CRM — project rules

A small CRM: Google Sheet backend, Next.js web app for the team, Claude Code commands for me.

## Rules (always follow)
- Do not deploy anywhere unless I explicitly ask.
- Never use, enable, or sign up for anything that costs money without my explicit approval.
- Never commit or push. I commit and push myself in GitHub Desktop. Don't use the GitHub CLI (`gh`) unless you first explain why it's needed and I agree. Read-only git commands (status, diff, log) are fine.
- Emails to clients and contacts always require a human clicking "Approve & send" in the web app. Commands only create drafts.
- Internal notification emails to teammates on the allowlist (ALLOWED_EMAILS) may be sent automatically, but must never go to a client or contact. They go only through `sendTeamEmail()` in `lib/notify.ts`, which enforces this. Never change this rule.
- Log every notification sent in the activity log.
- Every interaction gets logged, including who made it (`logged_by`) and the channel.
- Every contact has an owner and a next_followup_date unless the stage is Churned / Lost or research_status is Done.
- Never edit original transcripts or survey responses; only extract from them.
- When pulling out research findings, use only what the person actually said; never invent quotes or insights. Quotes must be verbatim from the transcript or survey text.
- Interview questions must be open-ended and non-leading.
- Never commit contact data, transcripts, keys, or credentials to git.
- Ask before deleting anything.
- Keep the code simple and readable.

## How things fit
- `lib/data/` is the only code that talks to storage. `DATA_BACKEND=demo|sheets` picks the adapter. To move to Supabase, add `lib/data/supabase.ts` implementing `Store` — nothing else changes.
- `lib/crm.ts` holds the business rules (ids, stage moves, follow-ups, logging, audit trail). The web app and `scripts/crm.ts` both use it.
- Slash commands in `.claude/commands/` run `npm run crm -- <command>`; run `npm run crm -- help` for the list.
- `lib/ai.ts` is optional: features turn on only when `ANTHROPIC_API_KEY` is set. Without it, AI work happens through the Claude Code commands.
- Who we sell to lives in `config.json` → `targetCustomer`, `onboardingSteps`, `retentionSignals` (read via `lib/target.ts`). Templates, survey, guides, and checklists are built from it in `lib/defaults.ts`. Keep UI labels generic ("contact", "client", "organization").
- Secrets live only in `.env.local` (and later Vercel env vars). `config.json` holds non-secret IDs.
- While `EMAIL_TEST_REDIRECT` is set, every send (outreach and notifications) goes to that address only.
- Team = `ALLOWED_EMAILS` (optionally `Name <email>`); tasks/clients store the teammate's name (`lib/team.ts`).
