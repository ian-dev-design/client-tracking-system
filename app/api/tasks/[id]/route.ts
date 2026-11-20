import { updateTask } from "@/lib/crm";
import { withUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const FIELDS = ["title", "due_date", "assigned_to", "contact_id", "notes", "priority", "done"];

// Edit a task, or check it off with { done: "TRUE" } / reopen with { done: "" }.
export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return updateTask(id, Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, String(body[k])])), user.name);
});
