import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadAll } from "@/lib/crm";
import { listUnmatched } from "@/lib/surveys";
import { isDueToday, isMine, isOverdue, tasksDue } from "@/lib/views";
import { Sidebar } from "@/components/Sidebar";
import { SurveyAutoSync } from "@/components/SurveySync";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const [{ contacts, drafts, tasks }, unmatched] = await Promise.all([loadAll(), listUnmatched()]);
  const mine = contacts.filter((c) => isMine(c.owner, user));
  const counts = {
    tasks: mine.filter((c) => isOverdue(c) || isDueToday(c)).length + tasksDue(tasks, user).length,
    drafts: drafts.filter((d) => d.status === "pending").length,
    unmatched: unmatched.length,
  };
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar counts={counts} userName={user.name} demo={user.demo} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-12 md:py-10">{children}</main>
      <SurveyAutoSync />
    </div>
  );
}
