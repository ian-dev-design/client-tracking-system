import { checkImport, csvToContacts, importContacts } from "@/lib/csv";
import { withUser } from "@/lib/api";

// { csv, dryRun: true }  → which rows are new, duplicates (by email), or missing a name. Nothing is saved.
// { csv, dryRun: false } → imports only the new rows.
export const POST = withUser(async (req, user) => {
  const { csv, dryRun } = await req.json();
  const { rows, ignoredColumns } = csvToContacts(String(csv || ""));
  if (!rows.length) throw new Error("No rows found. The first line must be a header row.");
  if (dryRun) return { checks: await checkImport(rows), ignoredColumns };
  return importContacts(rows, user.name);
});
