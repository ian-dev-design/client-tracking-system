import Link from "next/link";
import { CsvImport } from "@/components/CsvImport";
import { PageHeader } from "@/components/ui";

export default function ImportContacts() {
  return (
    <>
      <div className="mb-2 text-sm"><Link href="/contacts" className="text-muted hover:underline">← All contacts</Link></div>
      <PageHeader title="Import contacts" subtitle="Upload a CSV. You'll see which rows are new and which are duplicates (matched by email) before anything is saved." />
      <div className="max-w-4xl"><CsvImport /></div>
    </>
  );
}
