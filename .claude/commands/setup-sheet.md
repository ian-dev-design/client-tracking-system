---
description: Create/repair the Google Sheet tabs, headers, default email templates and interview guides
---
Set up the CRM Google Sheet.

1. Check `.env.local` has `DATA_BACKEND=sheets` and `GOOGLE_SERVICE_ACCOUNT_JSON`, and `config.json` has `spreadsheetId`. If anything is missing, explain exactly what to add (see README "Google setup") and stop. Never print the key.
2. Run `npm run crm -- setup-sheet`. It only adds missing tabs/columns and default templates/guides; it never deletes or reorders anything.
3. Report which tabs were created. Remind me the `survey_responses_raw` tab is created by linking the Google Form (README step 4).
4. Ask whether I want the 6 fake sample contacts in the Sheet. Only if I say yes, run `npm run crm -- seed-sample`.
