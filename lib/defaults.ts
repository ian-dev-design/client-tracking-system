// Default email templates, interview guides and survey questions, built from `targetCustomer` in config.json.
// setup-sheet writes the templates and guides to the Sheet; `npm run crm -- survey-script` writes the
// Google Form script. Change config.json and re-run those to switch industries.
//
// Template placeholders, filled per contact when a draft is made:
//   {first_name} {name} {company} {role} {survey_link} {sender_name}

import { ONBOARDING_STEPS, orList, target } from "@/lib/target";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const us = target.companyName;
const work = target.workArea;
const problem = lower(target.problemWeSolve);
const offer = lower(target.whatWeSell);

export const DEFAULT_TEMPLATES = [
  {
    name: "Prospect outreach",
    purpose: "outreach_prospect",
    subject: `Quick question about ${work} at {company}`,
    body:
`Hi {first_name},

I'm {sender_name} from ${us}. We help organizations like {company} with ${problem}.

Before suggesting anything, I'd love to understand how you handle ${work} today. Would you fill out a 3-minute survey?
{survey_link}

Thanks either way,
{sender_name}`,
    short_body: `Hi {first_name}, I'm {sender_name} from ${us}. We help with ${problem}. Would you share how {company} handles ${work} in a 3-min survey? {survey_link}`,
  },
  {
    name: "Research outreach",
    purpose: "outreach_research",
    subject: "Could I learn from your experience?",
    body:
`Hi {first_name},

I'm {sender_name}, and I'm learning how people in roles like yours handle ${work}. I'm not selling anything; I'm trying to understand what's hard and what works.

If you have 3 minutes, this short survey would help a lot:
{survey_link}

And if you'd be open to a 20-minute conversation afterward, I'd be grateful.

Thank you,
{sender_name}`,
    short_body: `Hi {first_name}, I'm {sender_name}, learning how people in your role handle ${work} (not selling anything). Would you share your experience in a 3-min survey? {survey_link}`,
  },
  {
    name: "Follow-up",
    purpose: "followup",
    subject: "Following up",
    body:
`Hi {first_name},

Just bumping this in case it got buried. The survey takes about 3 minutes:
{survey_link}

No worries if now isn't a good time.

{sender_name}`,
    short_body: "Hi {first_name}, just following up on the survey in case it got buried: {survey_link}",
  },
  {
    name: "Interview request",
    purpose: "interview_request",
    subject: "Thanks for your answers. 20 minutes to go deeper?",
    body:
`Hi {first_name},

Thank you for filling out the survey. Your answers were really helpful.

Would you be open to a 20-minute call so I can understand how ${work} works at {company} in more detail? Let me know a few times that suit you.

{sender_name}`,
    short_body: "Thanks for filling out the survey, {first_name}! Would you be open to a 20-min call to go deeper? Happy to work around your schedule.",
  },
  {
    name: "Welcome",
    purpose: "welcome",
    subject: `Welcome to ${us}, {first_name}!`,
    body:
`Hi {first_name},

We're excited to be working with {company}. Here's what happens next:

${ONBOARDING_STEPS.map((s, i) => `${i + 1}. ${s.label}`).join("\n")}

${target.welcomeNote ? `${target.welcomeNote} ` : ""}We'll be in touch to schedule the first step. Reply here with any questions; I'm your point of contact.

{sender_name}`,
    short_body: `Welcome to ${us}, {first_name}! Excited to work with {company}. I'll be in touch shortly to schedule the ${lower(ONBOARDING_STEPS[0]?.label || "first step")}.`,
  },
];

// Open-ended and non-leading: none of these mention our product or suggest an answer.
export const DEFAULT_GUIDES = [
  {
    name: "Customer discovery (research)",
    purpose: "research",
    questions:
`1. Tell me about your role and what you look after day to day.
2. Walk me through how ${work} works at your organization today, from start to finish.
3. Tell me about the last time it didn't go the way you wanted. What happened?
4. Which parts are hardest to keep up with? Why?
5. Who's involved: your own staff, contractors, vendors? How does that work?
6. How do you decide how much to spend on it, and who signs off?
7. What have you tried to make it easier? How did that go?
8. What other goals or rules shape how you handle this?
9. If you could change one thing about it, what would it be?
10. Is there anything I should have asked but didn't?
11. Who else do you think I should talk to?`,
  },
  {
    name: "Sales discovery",
    purpose: "sales_discovery",
    questions:
`1. What prompted you to take this conversation?
2. Walk me through how you handle ${work} today.
3. What does that cost you, in money, staff time, or other ways?
4. What have you tried so far? What happened with it?
5. How do decisions like this get made at your organization? Who else is involved?
6. What would need to be true for a new approach to be worth it?
7. What's your timeline, and what's driving it?
8. How do you usually budget for this kind of work?
9. What would make you hesitate?
10. What should the next step look like from your side?`,
  },
];

/** The discovery survey (Google Form). `choices` makes it a multiple-choice question. */
export type SurveyQuestion = { title: string; type: "text" | "paragraph" | "choice"; choices?: string[]; required?: boolean };

export const SURVEY: SurveyQuestion[] = [
  { title: "What's your role?", type: "text", required: true },
  { title: "What organization do you work for?", type: "text" },
  { title: "What kind of organization is it?", type: "choice", choices: [...target.customerTypes, "Other"] },
  { title: `How is ${work} handled today? (Who does it, and how often?)`, type: "paragraph" },
  { title: "What tools, vendors, or services do you use for it?", type: "paragraph" },
  { title: `What are the biggest headaches with ${work} right now?`, type: "paragraph", required: true },
  { title: "Roughly how much do you spend on it per year?", type: "choice", choices: ["Under $5k", "$5k–$25k", "$25k–$100k", "Over $100k", "Not sure"] },
  { title: "What have you tried that didn't work?", type: "paragraph" },
  { title: `If you could change one thing about how ${work} gets done, what would it be?`, type: "paragraph" },
  { title: "Would you be open to a 20-minute chat to go deeper?", type: "choice", choices: ["Yes", "Maybe", "No"], required: true },
];

/** Question titles in Form order (also the column headers in survey_responses_raw). */
export const SURVEY_QUESTIONS = SURVEY.map((q) => q.title);

/** One line of context for Claude prompts. */
export const targetSummary = () =>
  `We are ${us}. We sell: ${target.whatWeSell}. Ideal customers: ${target.idealCustomer} (for example ${orList(target.customerTypes.map(lower))}). ` +
  `We usually talk to ${orList(target.typicalRoles.map(lower))}. Problem we solve: ${target.problemWeSolve}.`;
