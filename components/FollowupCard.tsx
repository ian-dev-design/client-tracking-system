"use client";

// One follow-up: who, why, and the single next step that fits their stage. Log / Open live in "⋯".

import { useState } from "react";
import Link from "next/link";
import { DraftOutreachModal } from "./DraftOutreach";
import { LogInteractionModal } from "./LogInteraction";

export type FollowupAction = "draft" | "interview" | "log" | "checklist" | "checkin";
const LABEL: Record<FollowupAction, string> = {
  draft: "Draft outreach", interview: "Request interview", log: "Log call", checklist: "Open checklist", checkin: "Draft check-in",
};

export function FollowupCard({ contact, company, reason, overdue, accent, action, testRedirect }: {
  contact: Record<string, string>; company: string; reason: string; overdue: boolean; accent: string;
  action: FollowupAction; testRedirect?: string;
}) {
  const [open, setOpen] = useState<"" | "draft" | "log">("");
  const primary = action === "checklist"
    ? <Link href="/onboarding" className="btn btn-sm btn-primary">{LABEL[action]}</Link>
    : <button className="btn btn-sm btn-primary" onClick={() => setOpen(action === "log" ? "log" : "draft")}>{LABEL[action]}</button>;

  return (
    <div className={`flex items-center gap-3 border border-l-[3px] border-line bg-white px-3 py-2.5 ${accent}`}>
      <div className="min-w-0 flex-1">
        <Link href={`/contacts/${contact.id}`} className="block truncate text-sm font-semibold text-ink hover:underline">{contact.name}</Link>
        <div className="truncate text-xs">
          <span className={overdue ? "font-semibold text-coral" : "text-ink"}>{reason}</span>
          {company && <span className="text-muted"> · {company}</span>}
        </div>
      </div>
      {primary}
      <details className="relative">
        <summary className="cursor-pointer list-none px-1.5 text-lg leading-none text-muted hover:text-ink" aria-label="More actions">⋯</summary>
        <div className="absolute right-0 z-10 mt-1 w-32 border border-line bg-white py-1 text-sm">
          <button className="block w-full px-3 py-1.5 text-left hover:bg-surface" onClick={() => setOpen("log")}>Log</button>
          <Link href={`/contacts/${contact.id}`} className="block px-3 py-1.5 hover:bg-surface">Open</Link>
        </div>
      </details>
      {open === "draft" && <DraftOutreachModal contactIds={[contact.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={contact} onClose={() => setOpen("")} />}
    </div>
  );
}
