---
description: Move a client to Onboarding, create their checklist, and draft a welcome email
argument-hint: [contact name]
---
Start onboarding for: $ARGUMENTS

**Context:** read `targetCustomer` in config.json (who we sell to, what we sell, the problem we solve) and write for that audience.

1. Find them: `npm run crm -- contact "<name>"`. Confirm with me that they signed.
2. Run `npm run crm -- start-onboarding <id>` (moves to Onboarding, creates the onboarding row).
3. Draft a welcome email: `npm run crm -- draft-template <id> welcome`, personalize it with facts from their record, and save it with `npm run crm -- save-draft '<json>'`. **Do not send** — tell me to review it on the Drafts page.
4. Ask whether the first onboarding step (see `onboardingSteps` in config.json) is scheduled; if so, log it with /log.
