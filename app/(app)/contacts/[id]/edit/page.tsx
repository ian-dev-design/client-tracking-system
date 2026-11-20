import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { owners } from "@/lib/views";
import { ContactForm } from "@/components/ContactForm";
import { PageHeader } from "@/components/ui";

export default async function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { contacts, organizations }] = await Promise.all([currentUser(), loadAll()]);
  const contact = contacts.find((c) => c.id === id);
  if (!contact) notFound();
  return (
    <>
      <PageHeader title={`Edit ${contact.name}`} />
      <ContactForm initial={contact} owners={owners(contacts)} organizations={organizations.map((o) => o.name).sort()} defaultOwner={user?.name || ""} />
    </>
  );
}
