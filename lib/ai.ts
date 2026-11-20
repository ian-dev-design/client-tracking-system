// Optional AI features inside the web app. Everything here is a no-op until
// ANTHROPIC_API_KEY is set — then drafting and extraction turn on automatically.
// Without a key, the same work is done through the Claude Code commands.

import Anthropic from "@anthropic-ai/sdk";
import { targetSummary } from "@/lib/defaults";

const MODEL = "claude-opus-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const claude = () => (client ||= new Anthropic());

/** Ask Claude for JSON matching `schema`. Returns null if AI is off or the call fails. */
async function askJson<T>(system: string, user: string, schema: Record<string, unknown>): Promise<T | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("AI call failed:", err);
    return null;
  }
}

const str = { type: "string" };
const strArr = { type: "array", items: { type: "string" } };
const obj = (props: Record<string, unknown>) => ({
  type: "object", properties: props, required: Object.keys(props), additionalProperties: false,
});

export async function aiPersonalizeDraft(input: {
  contact: Record<string, string>; template: { subject: string; body: string; short_body: string };
  research: boolean; senderName: string; surveyLink: string;
}) {
  return askJson<{ subject: string; body: string; short_body: string }>(
    `You write short, warm, specific outreach emails for a small team. ${targetSummary()} ${
      input.research
        ? "This person is a research participant: ask to learn from their experience. Do not sell or pitch."
        : "This person is a potential customer: be helpful and direct, never pushy."
    } Keep the survey link exactly as given. Use only facts provided; never invent details about the person. Sign as ${input.senderName}.`,
    `Contact: ${JSON.stringify(input.contact)}\nSurvey link: ${input.surveyLink}\nTemplate to adapt:\nSubject: ${input.template.subject}\n${input.template.body}\n\nShort version (for LinkedIn/text, under 300 characters): ${input.template.short_body}`,
    obj({ subject: str, body: str, short_body: str }),
  );
}

export async function aiSurveyTakeaways(responses: string) {
  const out = await askJson<{ takeaways: string[] }>(
    "Summarize survey answers into 2-4 short takeaways. Use only what the respondent wrote; do not infer or embellish.",
    responses,
    obj({ takeaways: strArr }),
  );
  return out ? out.takeaways.map((t) => `- ${t}`).join("\n") : "";
}

export type InterviewExtraction = {
  summary: string; pain_points: string[]; current_tools: string[]; workflow: string;
  willingness_to_pay: string; key_quotes: string[]; themes: string[]; surprises: string; follow_up_actions: string;
};

export async function aiExtractInterview(transcript: string) {
  return askJson<InterviewExtraction>(
    `Context: ${targetSummary()} ` + "Extract research findings from an interview transcript. Use ONLY what the interviewee actually said. key_quotes must be copied verbatim from the transcript. If something wasn't discussed, write \"Not discussed\". themes are 1-4 word tags.",
    transcript,
    obj({
      summary: str, pain_points: strArr, current_tools: strArr, workflow: str, willingness_to_pay: str,
      key_quotes: strArr, themes: strArr, surprises: str, follow_up_actions: str,
    }),
  );
}
