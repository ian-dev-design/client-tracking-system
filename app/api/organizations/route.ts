import { ensureOrganization } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Create an organization (or return the existing one with the same name).
export const POST = withUser(async (req, user) => {
  const { name, type, address, notes } = await req.json();
  if (!name?.trim()) throw new Error("Organization name is required");
  return ensureOrganization(name, user.name, { type: type || "", address: address || "", notes: notes || "" });
});
