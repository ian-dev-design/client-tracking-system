import path from "node:path";
import { aiExtractInterview } from "@/lib/ai";
import { addInterview, getContact, saveTranscriptText, updateInterview } from "@/lib/crm";
import { extractText, readGoogleDoc } from "@/lib/transcripts";
import { withUser } from "@/lib/api";

const ALLOWED = [".txt", ".md", ".docx", ".vtt", ".srt", ".pdf"];

// Add an interview. The transcript is stored word for word in the CRM (transcripts tab) and can be read
// on the interview's "View transcript" page. If AI is on, findings are extracted; otherwise /log-interview does it.
export const POST = withUser(async (req, user) => {
  const form = await req.formData();
  const contactId = String(form.get("contactId") || "");
  const date = String(form.get("date") || "").slice(0, 10);
  const purpose = String(form.get("purpose") || "research");
  const pasted = String(form.get("text") || "");
  const docUrl = String(form.get("docUrl") || "").trim();
  const file = form.get("file");

  const contact = await getContact(contactId);
  if (!contact) throw new Error("Contact not found");
  if (!date) throw new Error("Date is required");

  let text = "";
  let link = ""; // only for Google Docs: a link back to the Doc itself
  if (file instanceof File && file.size > 0) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) throw new Error(`Unsupported file type ${ext}. Use ${ALLOWED.join(", ")}`);
    const data = Buffer.from(await file.arrayBuffer());
    // Plain-text formats are kept exactly as uploaded; .docx / .pdf keep the text inside them.
    text = [".txt", ".md", ".vtt", ".srt"].includes(ext) ? data.toString("utf8") : await extractText(file.name, data);
  } else if (docUrl) {
    if (user.demo) throw new Error("Google Doc links need the real Google setup (demo mode can't read Drive).");
    text = (await readGoogleDoc(docUrl)).text;
    link = docUrl;
  } else if (pasted.trim()) {
    text = pasted; // exactly as pasted
  } else {
    throw new Error("Paste a transcript, upload a file, or add a Google Doc link.");
  }

  const interview = await addInterview({
    contact_id: contactId, date, purpose, interviewer: user.name, transcript_link: link,
  }, user.name);
  await saveTranscriptText(interview.id, text, user.name);

  // Findings are pulled from the readable text (captions stripped for .vtt/.srt).
  const readable = file instanceof File && file.size > 0 ? await extractText(file.name, Buffer.from(text, "utf8")) : text;
  const found = readable ? await aiExtractInterview(readable) : null;
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
