import { createContact } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Create a contact (Add contact form).
export const POST = withUser(async (req, user) => {
  const body = await req.json();
  return createContact(body, user.name);
});
