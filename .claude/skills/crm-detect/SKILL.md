---
name: crm-detect
description: Set this CRM framework up for a new company or industry. Interviews the owner about their customers and process, rewrites config.json, regenerates the survey, templates and guides, then walks through the Google setup and the Netlify deploy. Use when someone says "set this up for <company>", "replicate the CRM for a client", "switch industries", or "make a copy for another business".
---

# Set the CRM up for a new company

The framework is industry-neutral. Almost everything company-specific lives in `config.json`; the survey,
email templates, interview guides and onboarding checklists are generated from it (`lib/target.ts`, `lib/defaults.ts`).
Follow the steps in order. Keep the rules in `CLAUDE.md` (never commit or push, ask before deleting, secrets only
in `.env.local` / Netlify, no paid services, no email to a client without "Approve & send").

## 1. Ask about the company (one short round of questions)

Ask the owner for anything you can't infer. Group the questions; don't ask one at a time.

- **Company:** name, industry, what they sell (one sentence), the problem it solves, a short phrase for the work area
  (e.g. "office cleaning"), an optional friendly line for the welcome email.
- **Customers:** ideal customer, 4–8 customer types (used in the survey's multiple choice), typical job titles.
- **Onboarding:** keep the 5 generic stages (Handoff → Welcome → Setup → First value → Success review) unless they
  want different ones. For each stage: a one-line description and 2–3 checklist steps in their words.
- **Retention:** 2–4 signs a customer is sticking around (e.g. "Renewed", "Added locations", "Gave a referral").
- **Locations ("sites"):** do they work at physical sites? Labels for size, notes, service dates, a unit, and site statuses.
- **Basics:** currency, time zone, default days until a follow-up (4 is the default).

## 2. Rewrite `config.json`

Edit only these keys; keep the JSON shape exactly as it is today:
`targetCustomer` (companyName, industry, whatWeSell, idealCustomer, customerTypes, typicalRoles, problemWeSolve,
workArea, welcomeNote), `onboardingStages` (key, label, description, steps[{key,label}]), `retentionSignals`,
`sites`, `currency`, `timeZone`, `followupDays`.

- Stage and step `key`s become Sheet column names: lowercase, snake_case, unique, and **never rename a key once a
  live Sheet uses it** (rename the `label` instead; old columns are never deleted).
- Leave `surveyLink`, `formId`, `emailEntryId`, `spreadsheetId` alone until step 4 creates the new Sheet and Form.
- Keep UI wording generic ("contact", "client", "organization"); company specifics belong in config only.

Then check it: `npx tsc --noEmit`.

## 3. Regenerate what's built from the config

```bash
npm run crm -- survey-script      # rewrites apps-script/create-crm.gs with the new survey questions
```

Show the owner the generated survey questions and the default email templates (`lib/defaults.ts` output) and adjust
wording in `config.json` until they're happy. Interview questions must stay open-ended and non-leading.

Optional: the demo sample data (`lib/data/sample.ts`) is written for the GoatOps example. It's fake and only shows
in demo mode, so it can stay; rewrite it only if the owner wants a themed demo.

## 4. Google setup (the owner does the clicking; you guide)

Walk through README.md → "Google setup", one step at a time, waiting for "done" between steps:
1. Paste `apps-script/create-crm.gs` into script.google.com → Run → copy the 4 IDs into `config.json`.
2. Google Cloud project; enable the Sheets, Drive and Gmail APIs.
3. Service account → JSON key → one line in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_JSON` (never in the repo);
   share the Sheet with the service account as Editor, and with nobody else.
4. OAuth consent screen (Internal if they're on Google Workspace, otherwise External + test users) with the
   `gmail.send` scope; OAuth client with the `http://localhost:3000/api/auth/callback/google` redirect.
5. `.env.local`: `DATA_BACKEND=sheets`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `ALLOWED_EMAILS`,
   `EMAIL_TEST_REDIRECT` = the owner's email (keep it until they're ready to email real people).
6. `npm run crm -- setup-sheet` (only adds tabs and columns), restart `npm run dev`, sign in.

Never ask the owner to paste a key or token into the chat; they put secrets in `.env.local` themselves.

## 5. Check it works

Sign in locally and click through: Dashboard, each journey board, a contact profile, Insights, Team.
Add one test contact, move it through a stage, and draft (don't send) an email. Confirm the survey link opens the
new Form and that a test response shows up after "Sync surveys now".

## 6. Deploy (only when the owner asks)

Follow `DEPLOY.md` (Netlify free plan). Things that trip people up:
- Mark only real secrets as secret in Netlify (`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`); plain values like `DATA_BACKEND` fail Netlify's secret scan.
- `NEXTAUTH_URL` = the Netlify URL (https, no trailing slash); add that origin and
  `/api/auth/callback/google` to the OAuth client.
- Set the Netlify project's visibility to Public; the app's own Google sign-in protects it, and the daily job
  can't reach a password-protected site.
- Stop if anything asks for a card or a paid plan.

## Time to expect

About half a day for a standard setup: ~1 hour of questions and config, ~1–2 hours of Google setup, ~30 minutes
to deploy. Changes beyond the config (new fields, new pages, different workflows) are extra and should be scoped
with the owner first.
