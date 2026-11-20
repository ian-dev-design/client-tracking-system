import fs from "node:fs";
import path from "node:path";
import { DEFAULT_GUIDES, DEFAULT_TEMPLATES, SURVEY_QUESTIONS } from "@/lib/defaults";
import { addDays, today } from "@/lib/util";
import type { Row, TableName } from "./schema";

// Six FAKE contacts for previewing the UI, written for the GoatOps example in config.json
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

export function buildSampleData(): { tables: Record<TableName, Row[]>; raw: string[][] } {
  const t = today();
  const d = (n: number) => addDays(t, n);
  const ts = (n: number) => `${d(n)}T15:00:00.000Z`;
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
      notes: "Two-acre back lot along the creek; residents asked for no weed killer.", ...base(-30) }),
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
    { id: "org_willow", name: "Willow Creek Apartments", type: "Apartment complex", address: "88 Creekside Dr, Millbrook", notes: "", ...base(-30) },
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
    ({ id, title, due_date: d(due), assigned_to, contact_id, done: done ? "TRUE" : "", done_at: done ? ts(due) : "", created_by: "Ian", created_at: ts(-6), updated_at: ts(-1) });
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

  // Onboarding columns follow onboardingSteps in config.json.
  const onboarding: Row[] = [
    { id: "ob_grace", contact_id: "c_grace", start_date: d(-16),
      site_visit: "TRUE", site_visit_date: d(-16),
      quote_approved: "TRUE", quote_approved_date: d(-12),
      herd_delivered: "TRUE", herd_delivered_date: d(-3),
      grazing_completed: "", grazing_completed_date: "",
      followup_checkin: "", followup_checkin_date: "",
      progress_pct: "60", health: "yellow", blockers: "Fence line by the creek needs repair before the herd can graze the back lot.", ...base(-16) },
  ];

  // Retention columns follow retentionSignals in config.json.
  const retention: Row[] = [
    { id: "rt_luis", contact_id: "c_luis", active_since: d(-110),
      seasonal_rebooking: "TRUE", seasonal_rebooking_date: d(-35),
      added_sites: "", added_sites_date: "",
      referral: "TRUE", referral_date: d(-35),
      notes: "Board may add the retention pond next year.", ...base(-110) },
  ];

  const email_templates = DEFAULT_TEMPLATES.map((tpl, i) => ({ id: `t_${i + 1}`, ...tpl, last_updated: t }));
  const interview_guides = DEFAULT_GUIDES.map((g, i) => ({ id: `g_${i + 1}`, ...g, last_updated: t }));

  return {
    tables: {
      contacts, interactions, surveys, interviews, transcripts, research_themes, onboarding, retention, organizations, sites, tasks,
      email_templates, interview_guides, drafts: [], activity_log: [],
    },
    raw,
  };
}
