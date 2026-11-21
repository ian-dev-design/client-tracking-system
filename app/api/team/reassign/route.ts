import { bulkReassign } from "@/lib/crm";
import { withUser } from "@/lib/api";

// Reassign several tasks or clients at once (Team page): { kind: "tasks" | "clients", ids: string[], to: string }.
// Logged per item; the new assignee gets one notification listing them all.
export const POST = withUser(async (req, user) => {
  const body = await req.json();
  return bulkReassign({
    kind: body.kind === "clients" ? "clients" : "tasks",
    ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
    to: String(body.to ?? ""),
  }, user.name);
});
