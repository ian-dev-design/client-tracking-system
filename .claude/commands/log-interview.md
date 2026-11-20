---
description: Save a transcript (any format) and extract findings into the interviews tab
argument-hint: [file path or Google Doc link, contact name] — or nothing to process pending app uploads
---
Log an interview: $ARGUMENTS

**Context:** read `targetCustomer` in config.json to understand the domain. Use it only for context: findings and quotes still come only from what people actually said, and questions must not mention what we sell.

**Never modify the original transcript. Use only what the interviewee actually said — quotes must be verbatim. Never invent insights.**

A) New transcript (file path, pasted text, or Google Doc link):
1. Identify the contact (`npm run crm -- contact "<name>"`); create them with /add-lead first if needed.
2. Ask the purpose: **research**, **sales_discovery**, or **both**. Ask the interview date if unclear.
3. Create the interview row: `npm run crm -- add-interview '{"contact_id":"...","date":"...","interviewer":"...","purpose":"..."}'` (for a Google Doc, also pass `"transcript_link":"<doc url>"`; the Doc must be shared with the service account email to be readable).
4. Store the transcript word for word on it:
   - File: `npm run crm -- attach-transcript <interviewId> <path>` (prints the readable text).
   - Pasted text: write it exactly as given to a temp .txt in the scratchpad, then attach that file.
   - Easiest for me: I can also paste it into the web app (**Add interview → Paste text**); then use option B.

B) No arguments: run `npm run crm -- interviews-pending` and process each (get text with `npm run crm -- transcript-text <interviewId>`).

Then extract and save with `npm run crm -- update-interview <id> '<json>'`:
- summary (3–4 sentences), pain_points (one per line), current_tools (comma-separated), workflow, willingness_to_pay ("Not discussed" if absent), key_quotes (verbatim, one per line), themes (1–4 word tags, comma-separated — reuse existing theme names from `npm run crm -- list research_themes` when they fit), surprises, follow_up_actions, `"extraction_status":"done"`.

Before saving, double-check every quote appears word-for-word in the transcript.

Finally suggest the next stage (e.g. Client Interview → Qualified if there's clear pain, a decision maker and a timeline; research_status → Interviewed) and ask before moving it with `npm run crm -- move`.
