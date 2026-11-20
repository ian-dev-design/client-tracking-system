---
description: Turn a research participant into a prospect
argument-hint: [contact name]
---
Convert to prospect: $ARGUMENTS

1. Find them: `npm run crm -- contact "<name>"`. Show their research status and a one-line summary of what they told us.
2. Confirm with me, then run `npm run crm -- convert <id>`. Their type becomes "both" (research history is kept) and they start at stage Lead.
3. Offer to draft prospect outreach with /outreach (drafts only — never sends).
