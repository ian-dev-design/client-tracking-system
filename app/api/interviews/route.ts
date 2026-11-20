import path from "node:path";
import { aiExtractInterview } from "@/lib/ai";
import { addInterview, getContact, updateInterview } from "@/lib/crm";
import { store } from "@/lib/data";
import { extractText, mimeFor, readGoogleDoc, transcriptFileName } from "@/lib/transcripts";
import { withUser } from "@/lib/api";

const ALLOWED = [".txt", ".md", ".docx", ".vtt", ".srt", ".pdf"];

// Add an interview: save the original transcript untouched, then (if AI is on) extract findings.
// Without an API key the interview is saved as "pending" and /log-interview extracts it later.
export const POST = withUser(async (req, user) => {
  const form = await req.formData();
  const contactId = String(form.get("contactId") || "");
  const date = String(form.get("date") || "").slice(0, 10);
  const purpose = String(form.get("purpose") || "research");
  const pasted = String(form.get("text") || "").trim();
  const docUrl = String(form.get("docUrl") || "").trim();
  const file = form.get("file");

  const contact = await getContact(contactId);
  if (!contact) throw new Error("Contact not found");
  if (!date) throw new Error("Date is required");

  let link = "";
  let text = "";
  if (file instanceof File && file.size > 0) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) throw new Error(`Unsupported file type ${ext}. Use ${ALLOWED.join(", ")}`);
    const data = Buffer.from(await file.arrayBuffer());
    link = await store().saveTranscript(transcriptFileName(contact.name, date, ext), data, mimeFor(file.name));
    text = await extractText(file.name, data);
  } else if (docUrl) {
    // The Google Doc itself is the original; we only read it and keep the link.
    if (user.demo) throw new Error("Google Doc links need the real Google setup (demo mode can't read Drive).");
    text = (await readGoogleDoc(docUrl)).text;
    link = docUrl;
  } else if (pasted) {
    const data = Buffer.from(pasted, "utf8");
    link = await store().saveTranscript(transcriptFileName(contact.name, date, ".txt"), data, "text/plain");
    text = pasted;
  } else {
    throw new Error("Paste a transcript, upload a file, or add a Google Doc link.");
  }

  const interview = await addInterview({
    contact_id: contactId, date, purpose, interviewer: user.name, transcript_link: link,
  }, user.name);

  const found = text ? await aiExtractInterview(text) : null;
  if (found) {
    await updateInterview(interview.id, {
      summary: found.summary, pain_points: found.pain_points.join("\n"),
      current_tools: found.current_tools.join(", "), workflow: found.workflow,
      willingness_to_pay: found.willingness_to_pay, key_quotes: found.key_quotes.join("\n"),
      themes: found.themes.join(", "), surprises: found.surprises,
      follow_up_actions: found.follow_up_actions, extraction_status: "done",
    }, user.name);
  }
  return { ok: true, id: interview.id, extracted: Boolean(found) };
});
