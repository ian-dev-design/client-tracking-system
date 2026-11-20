// CLI used by the Claude Code slash commands. Same business rules as the web app.
// Usage: npm run crm -- <command> [args]     (npm run crm -- help)

import "./env";
import fs from "node:fs";
import path from "node:path";
import { dataBackend } from "@/lib/config";
import * as crm from "@/lib/crm";
import { store, TABLES, type Row, type TableName } from "@/lib/data";
import { DEMO_TRANSCRIPTS_DIR, resetDemoData } from "@/lib/data/demo";
import { buildSampleData } from "@/lib/data/sample";
import { DEFAULT_GUIDES, DEFAULT_TEMPLATES } from "@/lib/defaults";
import { buildSurveyScript } from "@/lib/surveyScript";
import { buildDraft } from "@/lib/outreach";
import { syncSurveys, listUnmatched } from "@/lib/surveys";
import { extractText, googleDocId, mimeFor, readGoogleDoc, transcriptFileName } from "@/lib/transcripts";
import { isDueToday, isOverdue } from "@/lib/views";
import { nowIso, today } from "@/lib/util";

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

async function transcriptText(link: string): Promise<string> {
  if (link.startsWith("/api/demo-files/")) {
    const name = decodeURIComponent(link.split("/").pop()!);
    return extractText(name, fs.readFileSync(path.join(DEMO_TRANSCRIPTS_DIR, name)));
  }
  if (googleDocId(link)) return (await readGoogleDoc(link)).text;
  const id = link.match(/\/d\/([\w-]+)/)?.[1] || link.match(/[?&]id=([\w-]+)/)?.[1];
  if (!id) throw new Error("Can't read this transcript link");
  const { driveClient } = await import("@/lib/google");
  const drive = driveClient();
  const meta = await drive.files.get({ fileId: id, fields: "name", supportsAllDrives: true });
  const res = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return extractText(meta.data.name || "file.txt", Buffer.from(res.data as ArrayBuffer));
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
Interviews    save-transcript <contactId> <YYYY-MM-DD> <file>   save original untouched, print link + text
              read-file <file>                 print text of any transcript file
              add-interview '<json>'
              update-interview <id> '<json>'
              interviews-pending               interviews whose findings aren't extracted yet
              transcript-text <interviewId>
Tables        list <table>  |  get <table> <id>  |  upsert <table> <matchField> '<json>'
Setup         setup-sheet                      create tabs, headers, default templates & guides
              refresh-defaults                 rewrite default templates & guides from config.json
              survey-script                    regenerate apps-script/create-crm.gs from config.json
              seed-sample                      add the 6 fake contacts to an EMPTY Sheet
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
      return out(await store().update("surveys", a, { ...patch, updated_at: nowIso(), updated_by: actor }));
    }

    case "save-transcript": {
      const ct = await findContact(a);
      const data = fs.readFileSync(c);
      const link = await store().saveTranscript(transcriptFileName(ct.name, b, path.extname(c)), data, mimeFor(c));
      return out({ link, text: await extractText(c, data) });
    }
    case "read-file": return out(await extractText(a, fs.readFileSync(a)));
    case "add-interview": return out(await crm.addInterview(json(a), actor));
    case "update-interview": return out(await crm.updateInterview(a, json(b), actor));
    case "interviews-pending": return out((await store().list("interviews")).filter((i) => i.extraction_status !== "done"));
    case "transcript-text": {
      const iv = (await store().list("interviews")).find((i) => i.id === a);
      if (!iv) throw new Error("Interview not found");
      return out(await transcriptText(iv.transcript_link));
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
    case "seed-sample": {
      if (dataBackend() !== "sheets") return out("Use seed-demo for demo mode.");
      if ((await store().list("contacts")).length) throw new Error("contacts tab isn't empty — refusing to add sample data.");
      const { tables } = buildSampleData();
      // Upload the fake sample transcripts to the Drive folder so their links work.
      for (const iv of tables.interviews) {
        const file = path.join("sample-data", decodeURIComponent(iv.transcript_link.split("/").pop()!));
        iv.transcript_link = await store().saveTranscript(path.basename(file), fs.readFileSync(file), mimeFor(file));
      }
      for (const t of ["organizations", "contacts", "sites", "tasks", "interactions", "surveys", "interviews", "research_themes", "onboarding", "retention"] as TableName[]) {
        for (const row of tables[t]) await store().insert(t, row);
      }
      return out("Added 6 sample contacts (all fake, @example.com). Delete them from the Sheet when you're done.");
    }
    case "seed-demo": resetDemoData(); return out("Demo data reset to the 6 sample contacts.");

    default: throw new Error(`Unknown command "${cmd}". Run: npm run crm -- help`);
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
