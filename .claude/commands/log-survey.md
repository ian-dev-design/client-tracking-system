---
description: Write key takeaways for survey responses that don't have them yet
argument-hint: [optional contact name]
---
Fill in survey takeaways. $ARGUMENTS

1. Run `npm run crm -- sync-surveys` first, then `npm run crm -- surveys-pending` (or just the named contact's surveys via `npm run crm -- contact "<name>"`).
2. For each survey, read `responses` and write 2–4 short bullet takeaways ("- ..."). Use only what the respondent wrote — no inference, no embellishment. Flag if they said yes/maybe to a follow-up chat.
3. Save: `npm run crm -- update-survey <survey_id> '{"key_takeaways":"- ...\n- ..."}'`. Never change the `responses` field.
4. If someone is open to a chat, mention they're ready for an interview request (the app shows them under "★ Ready to request an interview").
