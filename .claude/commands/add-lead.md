---
description: Add a contact from pasted info
argument-hint: [paste name, company, role, email, LinkedIn, notes...]
---
Add a contact to the CRM from this info:

$ARGUMENTS

**Context:** read `targetCustomer` in config.json to judge fit and suggest a fit_score (1–5).

1. Pull out: name, company, role, email, phone, linkedin, source, notes. Use only what's given — don't guess emails or details.
2. Ask me: is this person a **prospect**, a **research participant**, or **both**? Also ask fit score (1–5) and owner if not obvious (default owner: me).
3. Check for duplicates: `npm run crm -- contact "<email or name>"`. If one exists, show it and ask before adding.
4. Create: `npm run crm -- add-contact '<json>'` (stage/research_status, owner and next_followup_date are filled automatically).
5. Confirm with the new id and a one-line summary.
