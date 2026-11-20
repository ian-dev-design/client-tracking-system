---
description: Draft personalized outreach for one or more contacts and save as drafts for review in the app (never sends)
argument-hint: [contact names/emails/ids, or "all leads"]
---
Draft outreach for: $ARGUMENTS

**Context:** read `targetCustomer` in config.json (who we sell to, what we sell, the problem we solve) and write for that audience.

**Never send anything.** This command only saves drafts; a teammate reviews each one in the web app and clicks "Approve & send".

For each contact:
1. Load them: `npm run crm -- contact "<name|email|id>"` (for "all leads", use `npm run crm -- list contacts` and pick stage Lead / research_status To Contact).
2. Get the starting template: `npm run crm -- draft-template <id>` (it picks the right template and fills the prefilled survey link).
3. Personalize it using only facts in their record (role, company, notes, survey answers, interviews). Keep it short and human.
   - Research participants: ask to learn from their experience. No selling, no product pitch.
   - Prospects: helpful and direct, never pushy.
   - Keep `{survey_link}` exactly as filled in the template. Never invent facts about the person.
   - Also write a `short_body` under 300 characters for LinkedIn/iMessage.
4. Save: `npm run crm -- save-draft '{"contact_id":"...","template":"...","subject":"...","body":"...","short_body":"..."}'`

Finish with a table of who got a draft, and tell me to review them on the **Drafts to review** page.
