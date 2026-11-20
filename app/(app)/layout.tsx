import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { listUnmatched } from "@/lib/surveys";
import { isDueToday, isMine, isOverdue, tasksDue } from "@/lib/views";
import { Sidebar } from "@/components/Sidebar";
import { checkAutoUrgent, notificationsFor } from "@/lib/notify";
import { SurveyAutoSync } from "@/components/SurveySync";
import { Toaster } from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  await checkAutoUrgent(user.email); // tasks that just hit 3+ days overdue → your bell
  const [{ contacts, drafts, tasks }, unmatched, notifications] = await Promise.all([loadAll(), listUnmatched(), notificationsFor(user.email)]);
  const mine = contacts.filter((c) => isMine(c.owner, user));
  const counts = {
    tasks: mine.filter((c) => isOverdue(c) || isDueToday(c)).length + tasksDue(tasks, user).length,
    drafts: drafts.filter((d) => d.status === "pending").length,
    unmatched: unmatched.length,
  };
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar counts={counts} userName={user.name} demo={user.demo}
        notifications={notifications.map((n) => ({ id: n.id, title: n.title, link: n.link, by: n.by, read: n.read, created_at: n.created_at, type: n.type }))} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-12 md:py-10">{children}</main>
      <SurveyAutoSync />
      <Toaster />
    </div>
  );
}
