import { addSite } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Add a site to an organization.
export const POST = withUser(async (req, user) => addSite(await req.json(), user.name));
