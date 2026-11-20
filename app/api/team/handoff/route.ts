import { handOff } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Move open tasks and/or owned clients from one teammate to another: { from, to, taskIds, contactIds }.
// Only runs after the person reviewed the preview and clicked confirm. Sends no notifications.
export const POST = withUser(async (req, user) => {
  const body = await req.json();
  if (body.confirmed !== true) throw new Error("Review the list and confirm to hand off.");
  return handOff({
    from: String(body.from ?? ""), to: String(body.to ?? ""),
    taskIds: Array.isArray(body.taskIds) ? body.taskIds.map(String) : [],
    contactIds: Array.isArray(body.contactIds) ? body.contactIds.map(String) : [],
  }, user.name);
});
