---
description: Synthesize all interviews and surveys into research themes + a short report
---
Run a research synthesis.

**Context:** read `targetCustomer` in config.json to understand the domain. Use it only for context: findings and quotes still come only from what people actually said, and questions must not mention what we sell.

1. Load everything: `npm run crm -- list interviews`, `npm run crm -- list surveys`, `npm run crm -- list research_themes`, `npm run crm -- list contacts` (for roles/companies).
2. If any interviews are pending extraction, offer to run /log-interview first.
3. Group findings into themes (reuse existing theme names where they fit; merge near-duplicates). For each theme:
   - description (one sentence), interview_count, linked_interview_ids (comma-separated), example_quotes (2–3 verbatim quotes, one per line).
   - Only count an interview if the person actually talked about it. Quotes must be copied exactly from `key_quotes` or the transcript.
4. Save each: `npm run crm -- upsert research_themes theme '{"theme":"...","description":"...","interview_count":"3","linked_interview_ids":"...","example_quotes":"..."}'`
   Ask before removing any theme that no longer has support.
5. Give me a short report (under 300 words): top patterns with counts, differences by role/company, surprises, contradictions, and 3 things to dig into next (with suggested open-ended questions). Be honest about small sample sizes.
