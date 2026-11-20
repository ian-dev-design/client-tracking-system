import { ResearchTabs } from "@/components/ResearchTabs";
import { PageHeader } from "@/components/ui";

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Research" stage="research" />
      <ResearchTabs />
      {children}
    </>
  );
}
