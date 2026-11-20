import { loadAll, transcriptFor } from "@/lib/crm";
import { transcriptFileName } from "@/lib/transcripts";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Download an interview's transcript as a .txt file (signed-in, allowlisted users only).
export const GET = withUser<Ctx>(async (_req, _user, { params }) => {
  const { id } = await params;
  const { interviews, contacts, transcripts } = await loadAll();
  const iv = interviews.find((i) => i.id === id);
  if (!iv) throw new Error("Interview not found");
  const text = transcriptFor(id, transcripts);
  if (!text) throw new Error("No transcript stored for this interview");
  const name = transcriptFileName(contacts.find((c) => c.id === iv.contact_id)?.name || "interview", iv.date, ".txt");
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
});
