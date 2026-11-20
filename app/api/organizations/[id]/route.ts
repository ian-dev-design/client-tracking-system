import { updateOrganization } from "@/lib/crm";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Edit an organization (name, type, address, notes).
export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const patch = Object.fromEntries(["name", "type", "address", "notes"].filter((k) => body[k] !== undefined).map((k) => [k, String(body[k])]));
  return updateOrganization(id, patch, user.name);
});
