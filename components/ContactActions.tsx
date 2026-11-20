"use client";

import { useState } from "react";
import Link from "next/link";
import { DraftOutreachModal } from "./DraftOutreach";
import { LogInteractionModal } from "./LogInteraction";
import { AddInterviewModal } from "./AddInterview";

// A contact row from the store (all values are strings).
type C = Record<string, string>;

/** The action buttons on a contact (profile header, cards, tables). */
export function ContactActions({ contact, size = "md", show = ["draft", "log", "view"], testRedirect, aiEnabled = false }: {
  contact: C; size?: "sm" | "md"; show?: ("draft" | "log" | "view" | "interview" | "edit")[];
  testRedirect?: string; aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState<"" | "draft" | "log" | "interview">("");
  const cls = `btn ${size === "sm" ? "btn-sm" : ""}`;
  return (
    <>
      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        {show.includes("draft") && <button className={`${cls} ${size === "md" ? "btn-primary" : ""}`} onClick={() => setOpen("draft")}>Draft outreach</button>}
        {show.includes("interview") && <button className={cls} onClick={() => setOpen("interview")}>+ Add interview</button>}
        {show.includes("log") && <button className={cls} onClick={() => setOpen("log")}>Log</button>}
        {show.includes("edit") && <Link className={cls} href={`/contacts/${contact.id}/edit`}>Edit</Link>}
        {show.includes("view") && <Link className={cls} href={`/contacts/${contact.id}`}>Open</Link>}
      </div>
      {open === "draft" && <DraftOutreachModal contactIds={[contact.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={contact} onClose={() => setOpen("")} />}
      {open === "interview" && <AddInterviewModal contact={contact} aiEnabled={aiEnabled} onClose={() => setOpen("")} />}
    </>
  );
}
