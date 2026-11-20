import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAll, transcriptFor } from "@/lib/crm";
import { formatDate } from "@/lib/util";
import { PageHeader } from "@/components/ui";

// Read an interview's full transcript, exactly as it was pasted or uploaded.
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { interviews, contacts, transcripts } = await loadAll();
  const iv = interviews.find((i) => i.id === id);
  if (!iv) notFound();
  const contact = contacts.find((c) => c.id === iv.contact_id);
  const text = transcriptFor(id, transcripts);

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href={`/contacts/${iv.contact_id}`} className="text-muted hover:underline">← {contact?.name || "Contact"}</Link>
      </div>
      <PageHeader title="Transcript"
        subtitle={[contact?.name, contact?.company, formatDate(iv.date), iv.purpose?.replace("_", " ")].filter(Boolean).join(" · ")}>
        {text && <a href={`/api/interviews/${id}/transcript`} className="btn" download>Download .txt</a>}
        {iv.transcript_link && <a href={iv.transcript_link} target="_blank" className="btn">Open Google Doc ↗</a>}
      </PageHeader>
      {text ? (
        <article className="max-w-3xl border border-line bg-white p-6 sm:p-8">
          <p className="eyebrow mb-4">Original, unedited · {text.length.toLocaleString()} characters</p>
          <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-ink">{text}</div>
        </article>
      ) : (
        <p className="muted">No transcript is stored for this interview.</p>
      )}
    </>
  );
}
