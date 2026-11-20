---
description: Log any interaction and update the stage
argument-hint: [who, what happened, channel]
---
Log this interaction: $ARGUMENTS

1. Find the contact: `npm run crm -- contact "<name>"`.
2. Work out type (email/text/survey/call/interview/meeting/note), channel (gmail/linkedin/imessage/other), date (default today) and a one-line summary. Ask if unclear — every interaction needs a channel.
3. Suggest a stage / research status change if it fits, and a next follow-up date (default 4 days). Ask me to confirm. Moving to "Churned / Lost" needs a reason — ask me for it and pass it as `lost_reason`. Moving to "Onboarding" creates the checklist automatically.
4. Save: `npm run crm -- log '{"contact_id":"...","type":"...","channel":"...","summary":"...","date":"YYYY-MM-DD","stage":"(optional)","next_followup_date":"(optional)"}'`
