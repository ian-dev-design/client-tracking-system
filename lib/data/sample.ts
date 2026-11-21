import fs from "node:fs";
import path from "node:path";
import { DEFAULT_GUIDES, DEFAULT_TEMPLATES, SURVEY_QUESTIONS } from "@/lib/defaults";
import { addDays, today } from "@/lib/util";
import { ONBOARDING_STAGES, enteredCol } from "@/lib/onboarding";
import type { Row, TableName } from "./schema";

// FAKE contacts for previewing the UI, written for the GoatOps example in config.json
// (goat grazing for organizations with land to maintain). All names, organizations and quotes are made up.
// Quotes are copied word for word from the fake transcripts in sample-data/.
// Dates are relative to today so the demo always looks current.
//
//   Dana Whitfield   office park        Lead (follow-up overdue)
//   Priya Shah       university         Survey Completed, prospect + research (survey waiting to sync)
//   Tom Becker       city parks dept    Client Interview, interviewed (transcript)
//   Grace Kim        apartment complex  Onboarding (checklist part done, one blocker)
//   Luis Ortega      HOA                Active / Retention (re-booked; quiet for 5 weeks)
//   Harold Jensen    golf course        research only, Interviewed (transcript)
//
// Each contact belongs to an organization; Millbrook, Cedar Hollow and Willow Creek have several sites.
// Deals: $50.5k open across Dana, Priya and Tom; Grace and Luis are won. A few tasks, one assigned to a teammate.
//
// Plus 16 more (bottom of this file) so the boards and Insights look real, spread over ~90 days:
//   Outreach    Nina (Outreach), Marcus (Qualified); lost: Carla (at Outreach), Brian (at Survey), Ethan (at Interview)
//   Onboarding  Ray (Handoff), Sofia (Welcome), Grace + Ken (Setup; Grace is stuck), Amara (First value), Jo (Success review)
//   Retention   Hannah (healthy, renews in 20 days), Owen (at risk: quiet 50 days), Mei (just renewed),
//               Victor (overdue task, set to healthy by hand), Luis (quiet 5 weeks); churned: Paul and Diane, each with a reason
// Every contact has stage history; finished onboardings have stage timestamps, so Insights has averages.

export function buildSampleData(): { tables: Record<TableName, Row[]>; raw: string[][] } {
  const t = today();
  const d = (n: number) => addDays(t, n);
  const ts = (n: number) => `${d(n)} 08:00`;
  const base = (n: number) => ({ created_at: ts(n), updated_at: ts(n), updated_by: "Ian" });
  const contact = (c: Row): Row => ({ phone: "", linkedin: "", lost_reason: "", research_status: "", stage: "", ...c });

  const contacts: Row[] = [
    contact({ id: "c_dana", name: "Dana Whitfield", company: "Ridgeview Office Park", role: "Facilities Manager",
      email: "dana.whitfield@example.com", linkedin: "linkedin.com/in/example-dana", source: "LinkedIn search",
      contact_type: "prospect", stage: "Lead", owner: "Ian", fit_score: "4", next_followup_date: d(-2),
      notes: "Three buildings with a steep, overgrown slope behind Building C.", ...base(-6) }),
    contact({ id: "c_priya", name: "Priya Shah", company: "Northgate University", role: "Sustainability & Facilities Coordinator",
      email: "priya.shah@example.com", source: "Campus sustainability fair",
      contact_type: "both", stage: "Survey Completed", research_status: "Survey Completed", owner: "Ian",
      fit_score: "5", next_followup_date: d(1), notes: "Campus has a climate pledge; interested in cutting gas mowers.", ...base(-12) }),
    contact({ id: "c_tom", name: "Tom Becker", company: "City of Millbrook Parks Department", role: "Parks Superintendent",
      email: "tom.becker@example.com", source: "Cold email",
      contact_type: "prospect", stage: "Client Interview", owner: "Ian", fit_score: "5", next_followup_date: t,
      notes: "Can approve up to $25k without council.", ...base(-20) }),
    contact({ id: "c_grace", name: "Grace Kim", company: "Willow Creek Apartments", role: "Property Manager",
      email: "grace.kim@example.com", source: "Referral from Luis Ortega",
      contact_type: "prospect", stage: "Onboarding", owner: "Ian", fit_score: "4", next_followup_date: d(2),
      notes: "Two-acre back lot along the creek; residents asked for no weed killer.", ...base(-56) }),
    contact({ id: "c_luis", name: "Luis Ortega", company: "Cedar Hollow HOA", role: "Community Operations Manager",
      email: "luis.ortega@example.com", source: "Inbound (website)",
      contact_type: "prospect", stage: "Active / Retention", owner: "Ian", fit_score: "4", next_followup_date: d(5),
      notes: "Grazed the common-area hillside last spring; board was happy.", ...base(-120) }),
    contact({ id: "c_harold", name: "Harold Jensen", company: "Pine Valley Golf Club", role: "Course Superintendent",
      email: "harold.jensen@example.com", source: "Regional turf-management forum",
      contact_type: "research_participant", research_status: "Interviewed", owner: "Ian", fit_score: "",
      next_followup_date: d(3), notes: "Research only for now: the board keeps grounds work in-house.", ...base(-25) }),
  ];

  // Organizations (one per contact here), their sites, and each contact's deal.
  const organizations: Row[] = [
    { id: "org_ridgeview", name: "Ridgeview Office Park", type: "Office park", address: "400 Ridgeview Pkwy, Millbrook", notes: "Three buildings; landscaping contract renews in March.", ...base(-6) },
    { id: "org_northgate", name: "Northgate University", type: "School or university", address: "1 University Ave, Northgate", notes: "Campus climate pledge: cut gas equipment 50% by 2028.", ...base(-12) },
    { id: "org_millbrook", name: "City of Millbrook Parks Department", type: "City or parks department", address: "210 Main St, Millbrook", notes: "Superintendent can approve up to $25k; above that goes to council.", ...base(-20) },
    { id: "org_willow", name: "Willow Creek Apartments", type: "Apartment complex", address: "88 Creekside Dr, Millbrook", notes: "", ...base(-56) },
    { id: "org_cedar", name: "Cedar Hollow HOA", type: "HOA", address: "Cedar Hollow Rd, Ashford", notes: "Board meets the first Tuesday of the month.", ...base(-120) },
    { id: "org_pinevalley", name: "Pine Valley Golf Club", type: "Golf course", address: "5 Fairway Ln, Ashford", notes: "", ...base(-25) },
  ];
  const deal: Record<string, Row> = {
    c_dana: { organization_id: "org_ridgeview", quote_amount: "", deal_value: "4500", expected_close_date: d(45), deal_status: "open" },
    c_priya: { organization_id: "org_northgate", quote_amount: "", deal_value: "18000", expected_close_date: d(75), deal_status: "open" },
    c_tom: { organization_id: "org_millbrook", quote_amount: "22000", deal_value: "22000", expected_close_date: d(30), deal_status: "open" },
    c_grace: { organization_id: "org_willow", quote_amount: "6800", deal_value: "6800", expected_close_date: d(-12), deal_status: "won" },
    c_luis: { organization_id: "org_cedar", quote_amount: "9500", deal_value: "9500", expected_close_date: d(-115), deal_status: "won" },
    c_harold: { organization_id: "org_pinevalley", quote_amount: "", deal_value: "", expected_close_date: "", deal_status: "" },
  };
  for (const c of contacts) Object.assign(c, deal[c.id]);

  const site = (id: string, organization_id: string, name: string, size: string, status: string, rest: Row = {}) =>
    ({ id, organization_id, name, size, status, address: "", notes: "", service_start: "", service_end: "", ...base(-5), ...rest });
  const sites: Row[] = [
    site("site_mb_pond", "org_millbrook", "Fenwick Pond banks", "6", "Quoted", { notes: "Steep banks; a mower rolled here last August.", address: "Fenwick Pond, off Linden St" }),
    site("site_mb_greenway", "org_millbrook", "Greenway east edge", "12", "Quoted", { notes: "Dry brush flagged by the fire marshal." }),
    site("site_mb_ditch", "org_millbrook", "Linden Street drainage ditch", "3", "Prospect", { notes: "Close to houses; residents complain about mower noise." }),
    site("site_cedar_hill", "org_cedar", "Common-area hillside", "4", "Completed", { service_start: d(-120), service_end: d(-110), notes: "Grazed last spring." }),
    site("site_cedar_hill_fall", "org_cedar", "Common-area hillside (fall)", "4", "Scheduled", { service_start: d(20), service_end: d(30) }),
    site("site_cedar_pond", "org_cedar", "Retention pond", "2", "Prospect", { notes: "Board may add next year." }),
    site("site_willow_back", "org_willow", "Back lot along the creek", "2", "In progress", { service_start: d(-3), service_end: d(6), notes: "Fence line by the creek needs repair first." }),
    site("site_willow_berm", "org_willow", "Front entrance berm", "0.5", "Quoted"),
    site("site_ridge_slope", "org_ridgeview", "Slope behind Building C", "3.5", "Prospect", { notes: "Too steep for the landscaper's mowers." }),
    site("site_ng_basin", "org_northgate", "Stormwater basin", "5", "Prospect"),
  ];

  // Tasks: several per contact are fine. "Jamie" shows a task assigned to a teammate.
  const task = (id: string, title: string, due: number, assigned_to: string, contact_id: string, done = false) =>
    ({ id, title, due_date: d(due), assigned_to, contact_id, done: done ? "TRUE" : "", done_at: done ? ts(due) : "", completed_at: done ? ts(due) : "", created_by: "Ian", created_at: ts(-6), updated_at: ts(-1) });
  const tasks: Row[] = [
    task("task_1", "Send grazing plan for the Fenwick Pond banks", 0, "Ian", "c_tom"),
    task("task_2", "Walk the greenway edge with Tom", 6, "Ian", "c_tom"),
    task("task_3", "Confirm the creek fence repair with maintenance", -1, "Ian", "c_grace"),
    task("task_4", "Quote the retention pond for next season", 3, "Jamie", "c_luis"),
    task("task_5", "Ask Priya for a 20-minute interview", 2, "Ian", "c_priya"),
    task("task_6", "Look up Ridgeview on the county parcel map", -4, "Ian", "c_dana", true),
  ];

  const interaction = (id: string, contact_id: string, n: number, type: string, channel: string, summary: string, extra: Row = {}) =>
    ({ id, contact_id, date: d(n), type, channel, summary, email_subject: "", email_body: "", logged_by: "Ian", created_at: ts(n), ...extra });

  const interactions: Row[] = [
    interaction("int_1", "c_dana", -6, "note", "other", "Added from LinkedIn: posted about the cost of slope mowing"),
    interaction("int_2", "c_priya", -10, "email", "gmail", "Sent research outreach with survey link", {
      email_subject: "Could I learn from your experience?",
      email_body: "Hi Priya,\n\nI'm Ian, and I'm learning how people in roles like yours handle grounds and land maintenance...",
    }),
    // Priya's survey interaction is added by the first sync (her raw response below is unprocessed).
    interaction("int_4", "c_tom", -18, "email", "gmail", "Sent prospect outreach with survey link", {
      email_subject: "Quick question about grounds and land maintenance at City of Millbrook Parks Department",
      email_body: "Hi Tom,\n\nI'm Ian from GoatOps. We help organizations like City of Millbrook Parks Department with keeping land clear...",
    }),
    interaction("int_5", "c_tom", -14, "survey", "other", "Completed the discovery survey"),
    interaction("int_6", "c_tom", -5, "interview", "other", "Discovery interview (40 min)"),
    interaction("int_7", "c_grace", -16, "meeting", "other", "Site visit: walked the back lot and creek edge"),
    interaction("int_8", "c_grace", -4, "email", "gmail", "Sent grazing plan; waiting on fence line repair"),
    interaction("int_9", "c_luis", -110, "meeting", "other", "Spring grazing finished on the common-area hillside"),
    interaction("int_10", "c_luis", -35, "call", "other", "Booked fall grazing; referred Grace Kim at Willow Creek"),
    interaction("int_11", "c_harold", -22, "text", "linkedin", "Asked to learn how the course handles hard-to-reach areas"),
    interaction("int_12", "c_harold", -8, "interview", "other", "Research interview (30 min)"),
  ];

  const surveys: Row[] = [
    { id: "sv_tom", contact_id: "c_tom", date_sent: d(-18), date_completed: d(-14),
      responses: "What's your role?\n→ Parks Superintendent\n\nWhat kind of organization is it?\n→ City or parks department\n\nWhat are the biggest headaches with grounds and land maintenance right now?\n→ Steep ditches and banks we can't mow safely, and residents complaining about noise.\n\nRoughly how much do you spend on it per year?\n→ $25k–$100k\n\nWould you be open to a 20-minute chat to go deeper?\n→ Yes",
      key_takeaways: "- Steep ditches and banks can't be mowed safely\n- Residents complain about mowing noise\n- Spends $25k–$100k a year; open to an interview",
      raw_key: "sample-tom", ...base(-14) },
  ];

  // The raw Google Form tab. Priya's response is NOT processed yet (sync picks it up);
  // the second response doesn't match any contact (shows under Unmatched surveys).
  const rawHeader = ["Timestamp", "Email Address", "Your email (so we can match your answers)", ...SURVEY_QUESTIONS];
  const raw: string[][] = [
    rawHeader,
    [`${d(-3)} 10:14:00`, "priya.shah@example.com", "priya.shah@example.com",
      "Sustainability & Facilities Coordinator", "Northgate University", "School or university",
      "Our grounds crew mows weekly; a contractor clears the wooded edges twice a year.",
      "Grounds crew, a landscaping contractor, gas mowers and trimmers.",
      "Hitting our climate pledge while still keeping the wooded edges and the stormwater basin clear.",
      "$25k–$100k", "We switched a few mowers to electric, but they can't handle the basin slopes.",
      "Fewer gas mowers and no herbicide near the dorms.", "Yes"],
    [`${d(-1)} 16:40:00`, "ops@riverside-distribution.example", "ops@riverside-distribution.example",
      "Operations Manager", "Riverside Distribution", "Warehouse",
      "Whoever is free on the dock crew does it when it gets bad.", "A rented brush cutter.",
      "The overgrown fence line is a fire risk and the insurer noticed.", "Under $5k",
      "Paying a landscaper once; it grew back in six weeks.", "Something that doesn't pull my team off the floor.", "Maybe"],
  ];

  const interviews: Row[] = [
    { id: "iv_tom", contact_id: "c_tom", date: d(-5), interviewer: "Ian", purpose: "both",
      transcript_link: "",
      summary: "Tom's department maintains fourteen parks, including about forty acres of ditches, ponds and slopes that riding mowers can't reach. They spend about $90k a year on contract mowing, residents complain about early-morning noise, and herbicide near playgrounds was stopped after parents objected. Dry brush along the greenway was flagged by the fire marshal. Tom can approve up to $25k himself.",
      pain_points: "Steep ditches and banks need crews with string trimmers for a whole day\nA contractor rolled a mower on the bank by Fenwick Pond\nConstant noise complaints from residents near Linden Street\nDry brush along the greenway flagged by the fire marshal",
      current_tools: "Contract mowing crews, riding mowers, string trimmers",
      workflow: "Contract crews mow parks nonstop May–September; hard-to-reach ditches and slopes are done by hand with string trimmers; herbicide spraying on ditch banks was stopped.",
      willingness_to_pay: "Spends about $90k a year on contract mowing; can approve up to $25k without council; would seek approval for next season if it cut slope costs.",
      key_quotes: "Honestly, the slopes are where my budget goes to die.\nThe noise complaints are constant.\nWe're not going back to herbicide near the playgrounds.\nIf something cut what we spend on those slopes, I could get it approved for next season.",
      themes: "Mowing costs, Hard-to-reach areas, Noise complaints, Avoiding chemicals, Fire safety",
      surprises: "A mower rollover on a pond bank cost them a machine and two weeks of schedule.",
      follow_up_actions: "Send a short grazing plan for the Fenwick Pond banks and greenway; ask for a site walk.",
      extraction_status: "done", ...base(-5) },
    { id: "iv_harold", contact_id: "c_harold", date: d(-8), interviewer: "Ian", purpose: "research",
      transcript_link: "",
      summary: "Harold looks after an eighteen-hole course plus about twelve acres of rough, creek banks and a steep ravine. Twice a year he pulls three crew members off the greens for a week of brush cutting. Chemicals aren't allowed near the creek, and the board wants a green certification. A 'naturalized area' experiment drew member complaints.",
      pain_points: "Ravine along the seventh hole is too steep for equipment\nCrew overtime pulled away from the greens\nNo chemicals within fifty feet of the creek\nBoard asking about sustainability without a clear answer",
      current_tools: "In-house crew, brush cutters",
      workflow: "Twice a year three crew members spend a week clearing the ravine with brush cutters; the rest of the year it's left alone.",
      willingness_to_pay: "Not discussed. The board keeps grounds work in-house for now.",
      key_quotes: "Every hour my crew spends in that ravine is an hour they're not on the greens.\nWe can't use chemicals within fifty feet of the water anyway.\nThey keep asking me what we're doing for sustainability, and I don't have a great answer.\nMembers complained it looked abandoned.",
      themes: "Hard-to-reach areas, Mowing costs, Avoiding chemicals, Sustainability goals",
      surprises: "Letting the ravine grow wild was tried, and members complained.",
      follow_up_actions: "Ask for an intro to the school district facilities team he mentioned.",
      extraction_status: "done", ...base(-8) },
  ];

  // The fake transcripts, stored word for word like any pasted transcript.
  const sampleText = (file: string) => fs.readFileSync(path.join(process.cwd(), "sample-data", file), "utf8");
  const transcripts: Row[] = [
    { id: "tr_tom", interview_id: "iv_tom", part: "1", text: sampleText("tom-becker-interview.vtt"), created_at: ts(-5) },
    { id: "tr_harold", interview_id: "iv_harold", part: "1", text: sampleText("harold-jensen-interview.txt"), created_at: ts(-8) },
  ];

  const research_themes: Row[] = [
    { id: "th_1", theme: "Hard-to-reach areas", description: "Slopes, ditches and ravines that mowers can't safely reach.",
      interview_count: "2", linked_interview_ids: "iv_tom, iv_harold",
      example_quotes: "Honestly, the slopes are where my budget goes to die.\nEvery hour my crew spends in that ravine is an hour they're not on the greens.", last_updated: d(-1) },
    { id: "th_2", theme: "Mowing costs", description: "Contract crews and staff overtime spent keeping land clear.",
      interview_count: "2", linked_interview_ids: "iv_tom, iv_harold",
      example_quotes: "If something cut what we spend on those slopes, I could get it approved for next season.", last_updated: d(-1) },
    { id: "th_3", theme: "Avoiding chemicals", description: "Herbicide is off the table near playgrounds and water.",
      interview_count: "2", linked_interview_ids: "iv_tom, iv_harold",
      example_quotes: "We're not going back to herbicide near the playgrounds.\nWe can't use chemicals within fifty feet of the water anyway.", last_updated: d(-1) },
    { id: "th_4", theme: "Noise complaints", description: "Neighbors and residents object to loud early-morning equipment.",
      interview_count: "1", linked_interview_ids: "iv_tom",
      example_quotes: "The noise complaints are constant.", last_updated: d(-1) },
    { id: "th_5", theme: "Sustainability goals", description: "Boards and leadership asking for greener grounds practices.",
      interview_count: "1", linked_interview_ids: "iv_harold",
      example_quotes: "They keep asking me what we're doing for sustainability, and I don't have a great answer.", last_updated: d(-1) },
    { id: "th_6", theme: "Fire safety", description: "Dry brush flagged as a fire risk.",
      interview_count: "1", linked_interview_ids: "iv_tom",
      example_quotes: "The fire marshal flagged it twice last summer.", last_updated: d(-1) },
  ];

  // Onboarding rows are built further down (with stage timestamps) by obRow().
  const onboarding: Row[] = [];

  // Retention columns follow retentionSignals in config.json.
  const retention: Row[] = [
    { id: "rt_luis", contact_id: "c_luis", active_since: d(-110),
      seasonal_rebooking: "TRUE", seasonal_rebooking_date: d(-35),
      added_sites: "", added_sites_date: "",
      referral: "TRUE", referral_date: d(-35),
      notes: "Board may add the retention pond next year.", ...base(-110) },
  ];

  addProcessHistory({ contacts, organizations, onboarding, retention, interactions, tasks, d, ts, base, contact });

  const email_templates = DEFAULT_TEMPLATES.map((tpl, i) => ({ id: `t_${i + 1}`, ...tpl, last_updated: t }));
  const interview_guides = DEFAULT_GUIDES.map((g, i) => ({ id: `g_${i + 1}`, ...g, last_updated: t }));

  return {
    tables: {
      contacts, interactions, surveys, interviews, transcripts, research_themes, onboarding, retention, organizations, sites, tasks,
      email_templates, interview_guides, drafts: [], activity_log: sampleActivityLog(tasks, ts), notifications: [], notification_settings: [],
      stage_history: stageHistory(contacts, onboarding, ts),
    },
    raw,
  };
}

// ---------- Process history: onboarding stages, retention, renewals, churn (all FAKE) ----------

const L = "Lead", O = "Outreach", S = "Survey Completed", I = "Client Interview", Q = "Qualified", ON = "Onboarding", A = "Active / Retention", X = "Churned / Lost";

/** A full sales path ending in onboarding on day h (and Active on day `active`, churned on day `churn`). */
const won = (h: number, active?: number, churn?: number): [string, number][] =>
  [[L, h - 28], [O, h - 25], [S, h - 20], [I, h - 14], [Q, h - 7], [ON, h], ...(active !== undefined ? [[A, active] as [string, number]] : []),
    ...(churn !== undefined ? [[X, churn] as [string, number]] : [])];

/** Pipeline stage history per contact: [stage, day offset from today]. */
const PATHS: Record<string, [string, number][]> = {
  c_dana: [[L, -6]],
  c_priya: [[L, -12], [O, -10], [S, -3]],
  c_tom: [[L, -20], [O, -18], [S, -14], [I, -5]],
  c_grace: won(-26),
  c_luis: won(-135, -110),
  c_nina: [[L, -9], [O, -7]],
  c_marcus: [[L, -40], [O, -38], [S, -33], [I, -25], [Q, -12]],
  c_brian: [[L, -55], [O, -52], [S, -45], [X, -30]],
  c_carla: [[L, -70], [O, -68], [X, -50]],
  c_ethan: [[L, -80], [O, -78], [S, -72], [I, -60], [X, -45]],
  c_ray: won(-2), c_sofia: won(-4), c_ken: won(-10), c_amara: won(-16), c_jo: won(-23),
  c_hannah: won(-64, -40), c_owen: won(-397, -370), c_mei: won(-403, -380), c_victor: won(-425, -400),
  c_paul: won(-400, -370, -40), c_diane: won(-327, -300, -70),
};

/** Onboarding plan: day they entered Handoff, and days spent in each finished stage (5 = completed). */
const OB_PLANS: Record<string, { h: number; durs: number[]; done?: string[]; health?: string; blockers?: string; handoff?: string; goals?: string }> = {
  c_ray: { h: -2, durs: [], done: ["handoff_meeting"], handoff: "Promised a site visit within two weeks. Main contact is Ray; invoices go to accounts@.", goals: "" },
  c_sofia: { h: -4, durs: [1], done: ["welcome_sent"], handoff: "Small lot behind the parish hall. Wants it done before the spring fair.", goals: "Lot clear and tidy for the spring fair." },
  c_grace: { h: -26, durs: [2, 5], done: ["site_visit"], health: "yellow", blockers: "Fence line by the creek needs repair before the herd can graze the back lot.",
    handoff: "Residents asked for no weed killer. Grace approves anything under $7k.", goals: "Back lot cleared without chemicals; no resident complaints." },
  c_ken: { h: -10, durs: [2, 4], done: [], handoff: "Three school sites; start with the north field.", goals: "North field usable for PE by March." },
  c_amara: { h: -16, durs: [2, 3, 6], done: ["grazing_completed"], handoff: "Steep berm along the parking lot.", goals: "Berm cleared and photos for the tenant newsletter." },
  c_jo: { h: -23, durs: [2, 4, 7, 8], done: ["followup_checkin"], health: "green", handoff: "HOA board wants a fall booking too.", goals: "Hillside cleared; board votes to rebook." },
  c_luis: { h: -135, durs: [2, 4, 7, 8, 4] },
  c_hannah: { h: -64, durs: [1, 3, 6, 9, 5] },
  c_owen: { h: -397, durs: [3, 5, 8, 7, 4] },
  c_mei: { h: -403, durs: [2, 4, 6, 8, 3] },
  c_victor: { h: -425, durs: [2, 3, 7, 9, 4] },
  c_paul: { h: -400, durs: [2, 5, 9, 10, 4] },
  c_diane: { h: -327, durs: [3, 4, 8, 7, 5] },
};

type Ctx = {
  contacts: Row[]; organizations: Row[]; onboarding: Row[]; retention: Row[]; interactions: Row[]; tasks: Row[];
  d: (n: number) => string; ts: (n: number) => string; base: (n: number) => Row; contact: (c: Row) => Row;
};

function addProcessHistory({ contacts, organizations, onboarding, retention, interactions, tasks, d, ts, base, contact }: Ctx) {
  // Each new contact: [id, name, organization, org type, role, owner, stage, deal value, extra]
  const add = (id: string, name: string, org: string, type: string, role: string, owner: string, stage: string, value: string, extra: Row = {}) => {
    const { won: wasWon, ...rest } = extra; // won = a churned client whose deal had been won
    const orgId = `org_${id.slice(2)}`;
    const first = PATHS[id][0][1];
    organizations.push({ id: orgId, name: org, type, address: "", notes: "", ...base(first) });
    contacts.push(contact({
      id, name, company: org, organization_id: orgId, role, owner, stage, contact_type: "prospect", source: "Sample data",
      email: `${name.split(" ")[0].toLowerCase()}@example.com`, fit_score: "4", next_followup_date: stage === X ? "" : d(3),
      notes: "", quote_amount: value, deal_value: value, expected_close_date: "", deal_status: [ON, A].includes(stage) || wasWon ? "won" : stage === X ? "lost" : "open",
      ...base(first), ...rest,
    }));
  };
  add("c_nina", "Nina Castillo", "Brookside Logistics", "Warehouse", "Operations Manager", "Jamie", O, "3500");
  add("c_marcus", "Marcus Hill", "Fairview Elementary", "School or university", "Facilities Lead", "Ian", Q, "7200", { next_followup_date: d(1) });
  add("c_brian", "Brian Lee", "Summit Ridge Apartments", "Apartment complex", "Property Manager", "Sam", X, "5200", { lost_reason: "No budget this year" });
  add("c_carla", "Carla Diaz", "Westlake Church", "Church", "Office Manager", "Jamie", X, "1800", { lost_reason: "No reply after three tries" });
  add("c_ethan", "Ethan Moore", "Granite Falls Parks", "City or parks department", "Parks Director", "Ian", X, "26000", { lost_reason: "Signed a two-year mowing contract" });
  add("c_ray", "Ray Alvarez", "Eastside Warehouse Co.", "Warehouse", "Site Manager", "Sam", ON, "4800");
  add("c_sofia", "Sofia Brandt", "St. Mark's Church", "Church", "Parish Administrator", "Jamie", ON, "2400");
  add("c_ken", "Ken Okafor", "Brookline School District", "School or university", "Grounds Supervisor", "Ian", ON, "15500");
  add("c_amara", "Amara Lewis", "Harbor Point Office Campus", "Office park", "Facilities Director", "Ian", ON, "9800");
  add("c_jo", "Jo Martinez", "Sunset Hills HOA", "HOA", "Board Treasurer", "Jamie", ON, "6100");
  add("c_hannah", "Hannah Price", "Maple Grove Apartments", "Apartment complex", "Community Manager", "Ian", A, "7400", { renewal_date: d(20) });
  add("c_owen", "Owen Clarke", "Lakeside Business Park", "Office park", "Property Manager", "Sam", A, "12000", { renewal_date: d(25) });
  add("c_mei", "Mei Tanaka", "Oak Ridge School District", "School or university", "Facilities Manager", "Ian", A, "21000",
    { renewal_date: d(345), last_renewed_at: ts(-20), renewal_value: "23500" });
  // Victor's calculated health is "needs attention" (an overdue invoice task); Jamie set it to healthy by hand.
  add("c_victor", "Victor Reyes", "Riverbend Golf Club", "Golf course", "Course Manager", "Jamie", A, "14500", { renewal_date: d(75), health_override: "green",
    health_reason: "The overdue task is just an invoice; Jamie talked to Victor last week and he's happy" });
  add("c_paul", "Paul Novak", "Greenfield Distribution", "Warehouse", "Operations Director", "Ian", X, "8800", { won: "1", lost_reason: "Budget cut; went back to the landscaper" });
  add("c_diane", "Diane Foster", "Hillcrest Church", "Church", "Facilities Volunteer", "Sam", X, "3000", { won: "1", lost_reason: "Herd delivery was late twice" });
  // Existing clients: Luis renews in 50 days; Grace is still onboarding.
  Object.assign(contacts.find((c) => c.id === "c_luis")!, { renewal_date: d(50) });
  // Churned clients were updated on the day they churned.
  for (const id of ["c_brian", "c_carla", "c_ethan", "c_paul", "c_diane"]) {
    const c = contacts.find((x) => x.id === id)!;
    c.updated_at = ts(PATHS[id][PATHS[id].length - 1][1]);
  }

  // Onboarding rows with stage timestamps and checklists.
  for (const [cid, plan] of Object.entries(OB_PLANS)) {
    const entered = [plan.h];
    plan.durs.forEach((n, i) => entered.push(entered[i] + n));
    const curIdx = Math.min(plan.durs.length, ONBOARDING_STAGES.length - 1);
    const completed = plan.durs.length >= ONBOARDING_STAGES.length;
    const row: Row = {
      id: `ob_${cid.slice(2)}`, contact_id: cid, start_date: d(plan.h), progress_pct: "", health: plan.health || "green",
      blockers: plan.blockers || "", handoff_notes: plan.handoff || "", success_goals: plan.goals || "",
      onboarding_stage: ONBOARDING_STAGES[curIdx].key, completed_at: completed ? ts(entered[5]) : "", ...base(plan.h),
    };
    ONBOARDING_STAGES.forEach((st, i) => {
      if (i < entered.length && i <= curIdx) row[enteredCol(st.key)] = ts(entered[i]);
      const finished = completed || i < curIdx;
      for (const step of st.steps) {
        const on = finished || (i === curIdx && plan.done?.includes(step.key));
        row[step.key] = on ? "TRUE" : "";
        row[`${step.key}_date`] = on ? d(finished ? Math.max(entered[i], (entered[i + 1] ?? 0) - 1) : -1) : "";
      }
    });
    const all = ONBOARDING_STAGES.flatMap((st) => st.steps);
    row.progress_pct = String(Math.round((all.filter((st) => row[st.key] === "TRUE").length / all.length) * 100));
    onboarding.push(row);
  }

  // Retention rows for everyone who became a client.
  for (const id of ["c_hannah", "c_owen", "c_mei", "c_victor", "c_paul", "c_diane"]) {
    const activeDay = PATHS[id].find((p) => p[0] === A)![1];
    retention.push({ id: `rt_${id.slice(2)}`, contact_id: id, active_since: d(activeDay), seasonal_rebooking: id === "c_mei" ? "TRUE" : "",
      seasonal_rebooking_date: id === "c_mei" ? d(-20) : "", added_sites: "", added_sites_date: "", referral: "", referral_date: "", notes: "", ...base(activeDay) });
  }

  // Last real contact for each client (drives calculated health), plus a few touches along the way.
  const touch = (id: string, cid: string, n: number, type: string, summary: string, by = "Ian") =>
    interactions.push({ id, contact_id: cid, date: d(n), type, channel: type === "email" ? "gmail" : "other", summary, email_subject: "", email_body: "", logged_by: by, created_at: ts(n) });
  touch("int_s1", "c_hannah", -5, "call", "Check-in call: happy with the fall grazing", "Ian");
  touch("int_s2", "c_owen", -50, "email", "Sent the season recap and photos", "Sam");
  touch("int_s3", "c_mei", -10, "meeting", "Renewal meeting: signed for next year, adding a site", "Ian");
  touch("int_s4", "c_victor", -12, "call", "Talked about the ravine by the 7th hole", "Jamie");
  touch("int_s5", "c_ray", -2, "call", "Handoff call with sales", "Sam");
  touch("int_s6", "c_sofia", -3, "email", "Sent welcome email", "Jamie");
  touch("int_s7", "c_ken", -5, "meeting", "Walked the north field", "Ian");
  touch("int_s8", "c_amara", -3, "meeting", "First grazing finished on the berm", "Ian");
  touch("int_s9", "c_jo", -1, "call", "Success review booked with the board", "Jamie");
  touch("int_s10", "c_marcus", -12, "interview", "Discovery call: wants a quote for the back field", "Ian");
  touch("int_s11", "c_nina", -7, "email", "Sent prospect outreach with survey link", "Jamie");
  touch("int_s12", "c_paul", -45, "call", "Paul said the budget was cut", "Ian");
  touch("int_s13", "c_diane", -72, "call", "Diane raised the late deliveries again", "Sam");

  const task = (id: string, title: string, due: number, assigned_to: string, contact_id: string) =>
    tasks.push({ id, title, due_date: d(due), assigned_to, contact_id, done: "", done_at: "", completed_at: "", created_by: "Ian", created_at: ts(-8), updated_at: ts(-8), notes: "", priority: "" });
  task("task_s1", "Send the fall grazing invoice", -4, "Jamie", "c_victor");
  task("task_s2", "Book the site visit", 1, "Sam", "c_ray");
  task("task_s3", "Schedule the kickoff call", 2, "Jamie", "c_sofia");
  task("task_s4", "Send Marcus the quote", 2, "Ian", "c_marcus");
  task("task_s5", "Update the herd delivery checklist", 4, "", "");
  task("task_s6", "Call Owen about the season recap", -2, "Sam", "c_owen");
  Object.assign(tasks.find((t) => t.id === "task_s6")!, { priority: "Urgent" });

  // Finished tasks over the last 90 days for three teammates, some late, so the Team page's Efficiency tab
  // and the Insights charts have real variation. [created day, due after N days, finished after N days]
  const FINISHED: Record<string, [number, number, number][]> = {
    Ian: [[-86, 4, 3], [-74, 3, 5], [-63, 5, 4], [-55, 2, 2], [-41, 4, 6], [-33, 3, 2], [-26, 5, 5], [-19, 2, 4], [-12, 3, 1], [-8, 2, 2], [-5, 3, 2]],
    Jamie: [[-88, 3, 2], [-70, 4, 3], [-52, 3, 3], [-40, 5, 2], [-29, 2, 1], [-21, 4, 3], [-14, 3, 2], [-9, 2, 1], [-4, 3, 2], [-2, 1, 1]],
    Sam: [[-80, 3, 7], [-61, 2, 4], [-45, 4, 3], [-30, 2, 5], [-22, 3, 6], [-15, 2, 2], [-6, 3, 5]],
  };
  const TITLES = ["Send the site photos", "Confirm grazing dates", "Follow up on the quote", "Book the site walk", "Send the invoice",
    "Check the fence line", "Share the before-and-after photos", "Schedule the check-in call", "Update the herd plan", "Answer the board's questions", "Send the renewal reminder"];
  const CLIENTS = ["c_luis", "c_hannah", "c_mei", "c_victor", "c_grace", "c_amara", "c_jo", "c_owen", "c_tom", "c_ken", "c_paul"];
  let n = 0;
  for (const [who, rows] of Object.entries(FINISHED)) {
    rows.forEach(([created, dueIn, doneIn], i) => {
      const finished = `${d(created + doneIn)} ${String(10 + (i % 7)).padStart(2, "0")}:15`;
      tasks.push({ id: `task_f${++n}`, title: TITLES[(n * 3 + i) % TITLES.length], due_date: d(created + dueIn), assigned_to: who,
        contact_id: CLIENTS[(n + i) % CLIENTS.length], done: "TRUE", done_at: finished, completed_at: finished,
        created_by: n % 3 ? "Ian" : "Jamie", created_at: ts(created), updated_at: finished, notes: "", priority: "" });
    });
  }
  // Two more research participants (research board urgency: one overdue, one due today).
  for (const [id, name, org, type, status, follow, day] of [
    ["c_lena", "Lena Park", "Maple Street Elementary", "School or university", "Contacted", -3, -15],
    ["c_omar", "Omar Haddad", "Riverside Business Center", "Office park", "Interview Scheduled", 0, -20],
  ] as [string, string, string, string, string, number, number][]) {
    organizations.push({ id: `org_${id.slice(2)}`, name: org, type, address: "", notes: "", ...base(day) });
    contacts.push(contact({ id, name, company: org, organization_id: `org_${id.slice(2)}`, role: "Facilities Coordinator", owner: id === "c_lena" ? "Sam" : "Jamie",
      contact_type: "research_participant", research_status: status, email: `${name.split(" ")[0].toLowerCase()}@example.com`, source: "Sample data",
      fit_score: "", next_followup_date: d(follow), notes: "", quote_amount: "", deal_value: "", expected_close_date: "", deal_status: "", ...base(day) }));
  }
}

/** Activity log entries for the sample tasks (who assigned what), plus a couple of reassignments, for the Team → Activity tab. */
function sampleActivityLog(tasks: Row[], ts: (n: number) => string): Row[] {
  const log: Row[] = tasks.map((t, i) => ({
    id: `log_s${i}`, at: t.created_at, user: t.created_by || "Ian", action: "create", table: "tasks", record_id: t.id,
    details: `${t.created_by || "Ian"} added task “${t.title}” for ${t.assigned_to || "Unassigned"}`,
  }));
  log.push({ id: "log_r1", at: ts(-3), user: "Ian", action: "reassign", table: "tasks", record_id: "task_s2", details: "Ian reassigned task “Book the site visit” to Sam (was Ian)" });
  log.push({ id: "log_r2", at: ts(-1), user: "Jamie", action: "reassign", table: "contacts", record_id: "c_sofia", details: "Jamie reassigned Sofia Brandt to Jamie (was Sam)" });
  return log;
}

/** stage_history rows: every pipeline move from PATHS, and every onboarding stage entry from the onboarding rows. */
function stageHistory(contacts: Row[], onboarding: Row[], ts: (n: number) => string): Row[] {
  const out: Row[] = [];
  const owner = new Map(contacts.map((c) => [c.id, c.owner || "Ian"]));
  for (const [cid, path] of Object.entries(PATHS)) {
    path.forEach(([stage, day], i) => out.push({
      id: `sh_${cid.slice(2)}_${i}`, contact_id: cid, track: "pipeline", from_stage: i ? path[i - 1][0] : "", to_stage: stage, at: ts(day), by: owner.get(cid) || "Ian",
    }));
  }
  for (const o of onboarding) {
    let prev = "";
    for (const st of ONBOARDING_STAGES) {
      const at = o[enteredCol(st.key)];
      if (!at) break;
      out.push({ id: `sh_${o.id}_${st.key}`, contact_id: o.contact_id, track: "onboarding", from_stage: prev, to_stage: st.key, at, by: owner.get(o.contact_id) || "Ian" });
      prev = st.key;
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
