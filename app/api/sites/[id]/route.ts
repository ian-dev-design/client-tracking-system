import { updateSite } from "@/lib/crm";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const FIELDS = ["name", "address", "size", "notes", "service_start", "service_end", "status"];

// Edit a site.
export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return updateSite(id, Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, String(body[k])])), user.name);
});
