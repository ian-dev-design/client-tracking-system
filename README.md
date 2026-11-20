# CRM

A small CRM for two tracks: the **customer pipeline** (find → sign → onboard → keep) and **customer-discovery research** (interview people to learn about their problems).

- **Google Sheet** = the database (private: only you and a service account can open it)
- **Web app** (Next.js + Tailwind) = what teammates use. Sign in with Google; only allowlisted emails get in
- **Claude Code slash commands** = your automation for outreach drafts, surveys, interviews and research synthesis

Nothing is ever emailed without a person clicking **Approve & send**.

---

## Run it locally (demo data, no Google needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. `.env.local` starts with `DATA_BACKEND=demo`: 6 fake contacts stored in `.demo-data/` (git-ignored). You're "signed in" as `DEMO_USER_NAME`. Reset the demo data with `npm run seed-demo`.

---

## Google setup (switch from demo to the real Sheet)

Use your Berkeley Google Workspace account for all of this.

### 1. Create the Sheet and survey (5 min)
1. Go to https://script.google.com → **New project**.
2. Paste in [`apps-script/create-crm.gs`](apps-script/create-crm.gs), then click **Run** (`createCrm`) and approve the permissions.
3. Open **Execution log** and copy the 4 values into [`config.json`](config.json): `surveyLink`, `formId`, `emailEntryId`, `spreadsheetId`.

This creates a "CRM Database" Sheet and a 10-question discovery survey you own. The survey has email collection on and a prefillable email question. Responses land in the Sheet's `survey_responses_raw` tab.

### 2. Google Cloud project
1. Go to https://console.cloud.google.com → create a project called "CRM".
2. Under **APIs & Services → Library**, enable the **Google Sheets API**, **Google Drive API** and **Gmail API**.

### 3. Service account (lets the app read and write the Sheet)
1. Go to **IAM & Admin → Service Accounts → Create**, name it "crm-app", and skip the roles.
2. Open it → **Keys → Add key → JSON**. A file downloads. **Never commit it, and never put it in this folder.**
3. Put the whole JSON on one line in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_JSON=...`, then delete the downloaded file.
4. Open the Sheet → **Share** → paste the service account's email (`crm-app@...iam.gserviceaccount.com`) → **Editor**. Share it with nobody else.

### 4. Transcripts (nothing to set up)
Transcripts are stored word for word inside the CRM (the Sheet's `transcripts` tab; long ones are split across a few rows). Read one from the interview on a contact's profile → **View transcript**, or download it as `.txt`. No Drive folder or extra permission is needed.

### 5. Google sign-in (OAuth)
1. Go to **APIs & Services → OAuth consent screen**, set User type to **Internal** and the app name to "CRM", then save.
2. Under **Data access / Scopes**, add `.../auth/gmail.send`.
3. Go to **Credentials → Create credentials → OAuth client ID → Web application** and add this authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID and secret into `.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. Set `NEXTAUTH_SECRET` to the output of `openssl rand -base64 32`.

### 6. Switch over
In `.env.local`, set `DATA_BACKEND=sheets`, then run:

```bash
npm run crm -- setup-sheet
```

This adds all tabs, headers, default email templates and interview guides. It never deletes anything. Optionally run `npm run crm -- seed-sample` to add the 6 fake contacts (safe to re-run: it skips rows already there). Then restart `npm run dev` and sign in with Google.

> Keep `EMAIL_TEST_REDIRECT=you@berkeley.edu` while testing. Every "Approve & send" then goes to you, with the real recipient shown in the subject. Remove that line only when you're ready to email real people.

---

## Adding or removing a teammate

Access is controlled by **one setting**: `ALLOWED_EMAILS`, a comma-separated list.

- **Locally:** edit `ALLOWED_EMAILS` in `.env.local`, then restart `npm run dev`.
- **After deploying to Vercel (later):** go to Project → Settings → Environment Variables, edit `ALLOWED_EMAILS`, then **Redeploy**.

Removing someone locks them out on their next page load, even if they're still signed in. Anyone not on the list sees "You don't have access. Ask the owner to add you." Teammates never get access to the Sheet itself. Because the consent screen is **Internal**, only @berkeley.edu accounts can sign in at all.

---

## Pages

| Page | What it's for |
|---|---|
| **Dashboard** | Pipeline funnel, survey response rate, research interviews, active customers, top themes, follow-ups due, people ready for an interview |
| **Outreach board** | Kanban from Lead to Qualified. Drag to change stage; ⚑ means follow-up overdue. Tick several cards for bulk drafts, then review each before sending |
| **Contacts** | Everyone, with search and filters (stage, type, owner) |
| **Client profile** | All info, stage picker, timeline (including sent emails), survey answers, interviews and quotes, transcript links. Buttons: Draft outreach, Add interview, Log, Edit |
| **Research** | Interview library (filter by theme, role, company, purpose), Themes ranked by frequency, searchable Quotes wall, Participants list with research status |
| **Onboarding** | One card per client: progress, clickable checklist, health, blockers. Neediest first |
| **Retention** | Active customers: retention signals to check off (from `retentionSignals` in config.json), last contact (flagged after 30+ days quiet), notes, and Mark as churned |
| **My tasks** | Your follow-ups that are overdue or due today |
| **Drafts to review** | Drafts created by `/outreach`, reviewed and sent one at a time |
| **Unmatched surveys** | Form responses whose email didn't match a contact. Link one or create a contact |

**Draft outreach:** fills the right email template with the contact's name, company and a survey link prefilled with their email. Edit it, then either:
- **Approve & send:** sends from *your* Gmail, logs it, moves Lead → Outreach, and sets a follow-up 4 days out.
- **Copy text:** copies a short version for LinkedIn or iMessage. Then use **Mark as sent** (pick the channel) to log it and set the follow-up.

**Surveys** sync when the app opens, every 5 minutes while it's open, and whenever you click **Sync surveys now**. Matched responses are saved to the `surveys` tab, the contact moves to Survey Completed, and they're flagged "★ Ready to request an interview".

**Add interview:** upload .txt, .docx, .vtt/.srt, PDF, paste text, or give a Google Doc link. The transcript is stored in the CRM word for word and opens from the profile (**View transcript**). Tip: from Granola or any notes app, copy the transcript and use **Paste text**. Findings are extracted by `/log-interview`, or automatically if an API key is set (see below).

## Claude Code commands

Run these from this folder in Claude Code. They write to the Sheet through `npm run crm -- …`, which uses the same rules as the app.

| Command | What it does |
|---|---|
| `/setup-sheet` | Creates or repairs tabs, headers, default templates and guides |
| `/add-lead` | Adds a contact from pasted info (asks: prospect, research, or both) |
| `/outreach` | Writes personalized drafts and saves them for review in the app. **Never sends** |
| `/sync-surveys` | Manually pulls and matches Form responses |
| `/log-survey` | Writes key takeaways for survey responses |
| `/interview-guide` | Creates or updates an open-ended, non-leading interview guide |
| `/interview-prep` | Tailors a guide to one person using their survey answers |
| `/log-interview` | Stores a transcript (any format) word for word, extracts summary, pains, tools, quotes and themes, and suggests the next stage. With no arguments, it processes interviews added in the app |
| `/research-synthesis` | Updates `research_themes` and gives you a short patterns report |
| `/convert` | Turns a research participant into a prospect |
| `/start-onboarding` | Moves a client to Onboarding, creates the checklist, drafts a welcome email |
| `/log` | Logs any interaction and updates the stage |
| `/followups` | Lists follow-ups due today or overdue |

## Switching industries

Everything industry-specific lives in [`config.json`](config.json). The UI only ever says "contact", "client" and "organization".

| Setting | What it drives |
|---|---|
| `targetCustomer` | Company name, what we sell, ideal customer, customer types, typical roles, the problem we solve, and `workArea` (a short phrase like "grounds and land maintenance"). Used in the email templates, survey questions, interview guides, and Claude's prompts |
| `onboardingSteps` | The onboarding checklist (each `key` becomes a column in the `onboarding` tab) |
| `retentionSignals` | The signs a customer is staying, checked off on the Retention page (each `key` becomes a column in the `retention` tab) |

After editing it:
1. `npm run crm -- survey-script` regenerates [`apps-script/create-crm.gs`](apps-script/create-crm.gs). Run it in Apps Script to create a new Form.
2. `npm run crm -- setup-sheet` adds any new onboarding/retention columns (it never deletes old ones).
3. `npm run crm -- refresh-defaults` rewrites the default email templates and interview guides. Templates you added under other names are left alone.
4. In demo mode, `npm run seed-demo` resets the sample data. The bundled sample contacts are written for the GoatOps example.

## Turning on AI inside the app (optional, later)

Add `ANTHROPIC_API_KEY=...` to `.env.local` (or to Vercel) and restart. Draft outreach is then personalized by Claude, survey takeaways are written on sync, and transcripts are extracted on upload. No code changes needed: see [`lib/ai.ts`](lib/ai.ts).

## How the code is organized

```
lib/data/        storage: schema.ts (tabs+columns), sheets.ts, demo.ts, index.ts (picks one)
lib/crm.ts       business rules (ids, stages, follow-ups, logging, audit trail)
lib/surveys.ts   Form response matching      lib/outreach.ts  drafts
lib/transcripts.ts  any-format → text        lib/gmail.ts     send as the signed-in user
lib/auth.ts      Google sign-in + allowlist  lib/ai.ts        optional Claude features
app/(app)/       pages                       app/api/         endpoints
scripts/crm.ts   CLI for slash commands      .claude/commands slash commands
apps-script/     one-time Sheet+Form setup; form-submit ping for after deploy
```

**Moving to Supabase later:** write `lib/data/supabase.ts` implementing the `Store` interface in `lib/data/types.ts`, add it to `lib/data/index.ts`, and set `DATA_BACKEND=supabase`. The UI doesn't change.

## Deploying (not yet)

The code is deploy-ready for Vercel, but **don't deploy until the owner asks**. When you do:
- add every `.env.local` value as a Vercel environment variable
- add `https://<your-app>.vercel.app/api/auth/callback/google` to the OAuth client
- set `NEXTAUTH_URL` and `SURVEY_SYNC_SECRET`
- install [`apps-script/form-sync.gs`](apps-script/form-sync.gs) on the Form for instant sync
