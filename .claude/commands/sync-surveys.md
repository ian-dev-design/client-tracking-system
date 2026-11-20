---
description: Pull and match new Google Form responses (backup to the auto-sync)
---
1. Run `npm run crm -- sync-surveys` and report how many were matched / unmatched.
2. Run `npm run crm -- unmatched`. For each unmatched response, suggest a likely existing contact (by name/company) if there is one — but don't link anything without asking. Remind me they can be resolved on the **Unmatched surveys** page.
3. Run `npm run crm -- surveys-pending`. If any surveys are missing takeaways, offer to run /log-survey.
