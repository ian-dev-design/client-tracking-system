---
description: Tailor an interview guide to a specific person
argument-hint: [contact name]
---
Prepare for an interview with: $ARGUMENTS

**Context:** read `targetCustomer` in config.json to understand the domain. Use it only for context: findings and quotes still come only from what people actually said, and questions must not mention what we sell.

1. Load them: `npm run crm -- contact "<name>"` (survey answers, past interactions, interviews).
2. Pick the guide that fits (`npm run crm -- list interview_guides`): research, sales_discovery, or ask me.
3. Produce a one-page prep sheet:
   - Who they are (role, company, how we met) — facts only from the record.
   - What their survey said, quoted exactly.
   - 8–10 tailored questions that dig into their actual answers. Keep every question open-ended and non-leading.
   - 2–3 things we're trying to learn and what would surprise us.
4. Don't save anything unless I ask. If I confirm the interview is booked, offer to set research_status to "Interview Scheduled" or stage to "Client Interview" via `npm run crm -- move`.
