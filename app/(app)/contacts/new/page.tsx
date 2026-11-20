import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { owners } from "@/lib/views";
import { ContactForm } from "@/components/ContactForm";
import { PageHeader } from "@/components/ui";

export default async function NewContact({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { company } = await searchParams;
  const [user, { contacts, organizations }] = await Promise.all([currentUser(), loadAll()]);
  return (
    <>
      <PageHeader title="Add contact" subtitle="Only the name is required. You can fill in the rest later." />
      <ContactForm initial={typeof company === "string" ? { contact_type: "prospect", company } : undefined} owners={owners(contacts)} organizations={organizations.map((o) => o.name).sort()} defaultOwner={user?.name || ""} />
    </>
  );
}
