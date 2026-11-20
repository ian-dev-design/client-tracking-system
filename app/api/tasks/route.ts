import { addTask } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Create a task: { title, due_date, assigned_to ("" = Unassigned), contact_id, notes }.
export const POST = withUser(async (req, user) => addTask(await req.json(), user.name));
