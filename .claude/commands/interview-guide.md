---
description: Create or update a reusable interview guide (open-ended, non-leading)
argument-hint: [research | sales_discovery | both] [topic or name]
---
Create or update an interview guide: $ARGUMENTS

**Context:** read `targetCustomer` in config.json to understand the domain. Use it only for context: findings and quotes still come only from what people actually said, and questions must not mention what we sell.

1. Show existing guides: `npm run crm -- list interview_guides`. Ask whether to update one or create a new one, and what we want to learn.
2. Write 8–12 questions. Rules:
   - Open-ended ("Walk me through…", "Tell me about the last time…"). No yes/no questions.
   - Non-leading: never suggest an answer or assume a problem ("How frustrating is X?" ✗ → "How do you feel about X?" ✓).
   - Ask about past behavior, not hypotheticals or "would you buy".
   - For sales_discovery, include pain, current process, decision makers, timeline, budget — still neutral.
3. Show me the draft and revise until I approve.
4. Save: `npm run crm -- upsert interview_guides name '{"name":"...","purpose":"research|sales_discovery|both","questions":"1. ...\n2. ..."}'`
