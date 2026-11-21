// CLI used by the Claude Code slash commands. Same business rules as the web app.
// Usage: npm run crm -- <command> [args]     (npm run crm -- help)

import "./env";
import fs from "node:fs";
import path from "node:path";
import { dataBackend } from "@/lib/config";
import * as crm from "@/lib/crm";
import { store, TABLES, type Row, type TableName } from "@/lib/data";
import { resetDemoData } from "@/lib/data/demo";
import { buildSampleData } from "@/lib/data/sample";
import { DEFAULT_GUIDES, DEFAULT_TEMPLATES } from "@/lib/defaults";
import { buildSurveyScript } from "@/lib/surveyScript";
import { buildDraft } from "@/lib/outreach";
import { syncSurveys, listUnmatched } from "@/lib/surveys";
import { extractText, googleDocId, readGoogleDoc, stripCaptions } from "@/lib/transcripts";
import { isDueToday, isOverdue } from "@/lib/views";
import { nowStamp, today } from "@/lib/util";

const actor = `${process.env.OWNER_NAME || process.env.DEMO_USER_NAME || "Owner"} (Claude Code)`;
const out = (v: unknown) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

/** JSON from an argument: inline JSON, @path/to/file.json, or - for stdin. */
function json(arg?: string): Row {
  if (!arg) throw new Error("Missing JSON argument");
  const text = arg === "-" ? fs.readFileSync(0, "utf8") : arg.startsWith("@") ? fs.readFileSync(arg.slice(1), "utf8") : arg;
  return JSON.parse(text);
}

function table(name?: string): TableName {
  if (!name || !(name in TABLES)) throw new Error(`Unknown table. One of: ${Object.keys(TABLES).join(", ")}`);
  return name as TableName;
}

async function findContact(query: string) {
  const all = await store().list("contacts");
  const q = query.toLowerCase();
  const hits = all.filter((c) => c.id === query || c.email.toLowerCase() === q || c.name.toLowerCase().includes(q));
  if (!hits.length) throw new Error(`No contact matches "${query}"`);
  if (hits.length > 1 && !hits.some((c) => c.id === query)) {
    throw new Error(`Several contacts match "${query}": ${hits.map((c) => `${c.name} (${c.id})`).join(", ")}`);
  }
  return hits.find((c) => c.id === query) || hits[0];
}

/** An interview's transcript as readable text: the stored copy (captions stripped), or its Google Doc. */
async function transcriptText(iv: Row): Promise<string> {
  const stored = crm.transcriptFor(iv.id, await store().list("transcripts"));
  if (stored) return /-->/.test(stored) ? stripCaptions(stored) : stored;
  if (googleDocId(iv.transcript_link)) return (await readGoogleDoc(iv.transcript_link)).text;
  throw new Error("No transcript stored for this interview");
}

const HELP = `
Contacts      contact <id|email|name>          full profile (interactions, surveys, interviews)
              add-contact '<json>'             create (fills id, owner, follow-up)
              update-contact <id> '<json>'
              move <id> stage|research_status <value> [reason]
              convert <id>                     research participant → prospect
              start-onboarding <id>
              log '<json>'                     {contact_id,type,channel,summary,date?,stage?,next_followup_date?}
              followups [owner]                due today + overdue
              add-task '<json>'                {title,due_date?,assigned_to?,contact_id?}
              done-task <taskId>
              add-site '<json>'                {organization_id,name,address?,size?,notes?,service_start?,service_end?,status?}
Outreach      draft-template <id> [purpose]    filled template (starting point for /outreach)
              save-draft '<json>'              {contact_id,template,subject,body,short_body} → shows in app
Surveys       sync-surveys                     match new Form responses
              unmatched                        responses with no matching contact
              surveys-pending                  surveys without key_takeaways
              update-survey <id> '<json>'
Interviews    attach-transcript <interviewId> <file>   store a transcript word for word on an interview
              read-file <file>                 print text of any transcript file
              add-interview '<json>'
              update-interview <id> '<json>'
              interviews-pending               interviews whose findings aren't extracted yet
              transcript-text <interviewId>
Tables        list <table>  |  get <table> <id>  |  upsert <table> <matchField> '<json>'
Setup         setup-sheet                      create tabs, headers, default templates & guides (only adds)
              migrate-process [--apply]        fill onboarding stages + stage history for older data (dry run without --apply)
              refresh-defaults                 rewrite default templates & guides from config.json
              survey-script                    regenerate apps-script/create-crm.gs from config.json
              seed-sample                      add the fake sample contacts (skips any already there)
              format-timestamps                rewrite old ISO timestamps in the Sheet as "YYYY-MM-DD HH:MM"
              seed-demo                        reset local demo data
JSON args can be inline, @file.json, or - (stdin). Backend: ${dataBackend()}.`;

async function main() {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case "help": return out(HELP);

    case "contact": {
      const ct = await findContact(a);
      const all = await crm.loadAll();
      return out({
        contact: ct,
        interactions: all.interactions.filter((i) => i.contact_id === ct.id),
        surveys: all.surveys.filter((s) => s.contact_id === ct.id),
        interviews: all.interviews.filter((i) => i.contact_id === ct.id),
        onboarding: all.onboarding.filter((o) => o.contact_id === ct.id),
        retention: all.retention.filter((r) => r.contact_id === ct.id),
        organization: all.organizations.find((o) => o.id === ct.organization_id) || null,
        sites: all.sites.filter((x) => x.organization_id && x.organization_id === ct.organization_id),
        tasks: all.tasks.filter((t) => t.contact_id === ct.id),
        pending_drafts: all.drafts.filter((x) => x.contact_id === ct.id && x.status === "pending"),
      });
    }
    case "add-contact": return out(await crm.createContact(json(a), actor));
    case "add-task": return out(await crm.addTask(json(a), actor));
    case "done-task": return out(await crm.updateTask(a, { done: "TRUE" }, actor));
    case "add-site": return out(await crm.addSite(json(a), actor));
    case "update-contact": return out(await crm.updateContact(a, json(b), actor));
    case "move": return out(await crm.moveStage(a, b as "stage" | "research_status", c, actor, d || ""));
    case "convert": return out(await crm.convertToProspect(a, actor));
    case "start-onboarding": return out(await crm.startOnboarding(a, actor));
    case "log": {
      const body = json(a);
      const row = await crm.logInteraction(body, actor);
      if (body.stage) await crm.moveStage(body.contact_id, "stage", body.stage, actor, body.lost_reason || "");
      if (body.research_status) await crm.moveStage(body.contact_id, "research_status", body.research_status, actor);
      if (body.next_followup_date) await crm.updateContact(body.contact_id, { next_followup_date: body.next_followup_date }, actor);
      return out(row);
    }
    case "followups": {
      const all = await store().list("contacts");
      const rows = all.filter((x) => (isOverdue(x) || isDueToday(x)) && (!a || x.owner === a))
        .sort((x, y) => x.next_followup_date.localeCompare(y.next_followup_date))
        .map((x) => ({ id: x.id, name: x.name, company: x.company, owner: x.owner,
          due: x.next_followup_date, overdue: isOverdue(x), stage: x.stage || x.research_status }));
      return out(rows);
    }

    case "draft-template": return out(await buildDraft(a, process.env.OWNER_NAME || process.env.DEMO_USER_NAME || "", b));
    case "save-draft": return out(await crm.saveDraft(json(a), actor));

    case "sync-surveys": return out(await syncSurveys(actor));
    case "unmatched": return out(await listUnmatched());
    case "surveys-pending": return out((await store().list("surveys")).filter((s) => !s.key_takeaways?.trim()));
    case "update-survey": {
      const patch = json(b);
      delete patch.responses; // never edit the original answers
      return out(await store().update("surveys", a, { ...patch, updated_at: nowStamp(), updated_by: actor }));
    }

    case "attach-transcript": {
      // Store a transcript file word for word on an interview (plain-text formats as-is; .docx/.pdf as their text).
      const data = fs.readFileSync(b);
      const raw = [".txt", ".md", ".vtt", ".srt"].includes(path.extname(b).toLowerCase()) ? data.toString("utf8") : await extractText(b, data);
      await crm.saveTranscriptText(a, raw, actor);
      return out({ ok: true, characters: raw.length, text: await extractText(b, data) });
    }
    case "read-file": return out(await extractText(a, fs.readFileSync(a)));
    case "add-interview": return out(await crm.addInterview(json(a), actor));
    case "update-interview": return out(await crm.updateInterview(a, json(b), actor));
    case "interviews-pending": return out((await store().list("interviews")).filter((i) => i.extraction_status !== "done"));
    case "transcript-text": {
      const iv = (await store().list("interviews")).find((i) => i.id === a);
      if (!iv) throw new Error("Interview not found");
      return out(await transcriptText(iv));
    }

    case "list": return out(await store().list(table(a)));
    case "get": return out((await store().list(table(a))).find((r) => r.id === b) || null);
    case "upsert": return out(await crm.upsertByField(table(a), b, { ...json(c), last_updated: today() }, actor));

    case "setup-sheet": {
      if (dataBackend() !== "sheets") return out("DATA_BACKEND is not 'sheets' — nothing to set up. (Demo data lives in .demo-data/.)");
      const { ensureTabs } = await import("@/lib/data/sheets");
      const created = await ensureTabs();
      if (!(await store().list("email_templates")).length) {
        for (const t of DEFAULT_TEMPLATES) await crm.upsertByField("email_templates", "name", { ...t, last_updated: today() }, actor);
      }
      if (!(await store().list("interview_guides")).length) {
        for (const g of DEFAULT_GUIDES) await crm.upsertByField("interview_guides", "name", { ...g, last_updated: today() }, actor);
      }
      return out({ created_tabs: created, ok: true });
    }
    case "migrate-process": {
      // Fills blank onboarding-stage cells and backfills stage history. Dry run unless --apply.
      const { migrateProcess } = await import("@/lib/migrate");
      return out(await migrateProcess(a === "--apply", actor));
    }
    case "refresh-defaults": {
      // After changing targetCustomer in config.json: rewrite the default templates and guides (matched by name).
      // Templates or guides you added under other names are left alone.
      for (const t of DEFAULT_TEMPLATES) await crm.upsertByField("email_templates", "name", { ...t, last_updated: today() }, actor);
      for (const g of DEFAULT_GUIDES) await crm.upsertByField("interview_guides", "name", { ...g, last_updated: today() }, actor);
      return out({ templates: DEFAULT_TEMPLATES.length, guides: DEFAULT_GUIDES.length, ok: true });
    }
    case "survey-script": {
      fs.writeFileSync("apps-script/create-crm.gs", buildSurveyScript());
      return out("Wrote apps-script/create-crm.gs from config.json. Paste it into script.google.com to create the Form.");
    }
    case "format-timestamps": {
      if (dataBackend() !== "sheets") return out("Only needed for the Google Sheet.");
      const { reformatTimestamps } = await import("@/lib/data/sheets");
      return out(`Reformatted ${await reformatTimestamps()} timestamps to "YYYY-MM-DD HH:MM".`);
    }
    case "seed-sample": {
      if (dataBackend() !== "sheets") return out("Use seed-demo for demo mode.");
      // Adds only the sample rows that aren't there yet (matched by their fixed ids, e.g. c_tom), so it's
      // safe to re-run after an interruption and never duplicates or touches your own rows.
      const { tables } = buildSampleData();
      let added = 0;
      for (const t of ["organizations", "contacts", "sites", "tasks", "interactions", "surveys", "interviews", "transcripts", "research_themes", "onboarding", "retention", "stage_history"] as TableName[]) {
        const have = new Set((await store().list(t)).map((r) => r.id));
        for (const row of tables[t]) if (!have.has(row.id)) { await store().insert(t, row); added++; }
      }
      return out(`Added ${added} sample rows (fake contacts, @example.com). Delete them from the Sheet when you're done.`);
    }
    case "seed-demo": resetDemoData(); return out("Demo data reset to the sample contacts.");

    default: throw new Error(`Unknown command "${cmd}". Run: npm run crm -- help`);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
