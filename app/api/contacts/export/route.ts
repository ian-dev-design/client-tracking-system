import { loadAll } from "@/lib/crm";
import { contactsToCsv } from "@/lib/csv";
import { withUser } from "@/lib/api";

// Download every contact as a CSV file.
export const GET = withUser(async () => {
  const { contacts } = await loadAll();
  const name = `contacts-${new Date().toLocaleDateString("en-CA")}.csv`;
  return new Response(contactsToCsv(contacts), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
});
