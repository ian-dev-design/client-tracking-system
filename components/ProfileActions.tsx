"use client";

// Client profile header: ONE primary action matched to the stage, everything else in "⋯".

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddInterviewModal } from "./AddInterview";
import { DraftOutreachModal } from "./DraftOutreach";
import { LogInteractionModal } from "./LogInteraction";
import { ActionButton, MENU_ITEM, MoveButton } from "./Widgets";
import { toast } from "./Toast";

export type PrimaryAction = "draft" | "interview" | "log" | "checklist" | "checkin";
const LABEL: Record<PrimaryAction, string> = {
  draft: "Draft outreach", interview: "Request interview", log: "Log call", checklist: "Open checklist", checkin: "Draft check-in",
};

/** A small "⋯" menu that closes on outside click / Escape. */
export function MoreMenu({ label, children, width = "w-56" }: { label: string; children: React.ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const scroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  // Floats above the page (fixed), so tables and scroll areas never clip it.
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(!open);
  };
  return (
    <div ref={box} className="relative">
      <button ref={btn} type="button" className="btn px-2.5" aria-label={label} aria-expanded={open} onClick={toggle}>⋯</button>
      {open && (
        <div className={`fixed z-40 ${width} border border-line bg-white py-1`} style={{ top: pos.top, right: pos.right }} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ProfileActions({ contact, primary, testRedirect, aiEnabled }: {
  contact: Record<string, string>; primary: PrimaryAction; testRedirect?: string; aiEnabled: boolean;
}) {
  const [open, setOpen] = useState<"" | "draft" | "log" | "interview">("");
  const c = contact;
  return (
    <div className="flex items-center gap-2">
      {primary === "checklist"
        ? <Link href="/onboarding" className="btn btn-primary">{LABEL[primary]}</Link>
        : <button className="btn btn-primary" onClick={() => setOpen(primary === "log" ? "log" : "draft")}>{LABEL[primary]}</button>}
      <MoreMenu label={`More actions for ${c.name}`}>
        {primary !== "draft" && primary !== "interview" && primary !== "checkin" && <button className={MENU_ITEM} onClick={() => setOpen("draft")}>Draft outreach</button>}
        {primary !== "log" && <button className={MENU_ITEM} onClick={() => setOpen("log")}>Log interaction</button>}
        <button className={MENU_ITEM} onClick={() => setOpen("interview")}>Add interview</button>
        <Link className={MENU_ITEM} href={`/contacts/${c.id}/edit`}>Edit contact</Link>
        {(c.contact_type === "research_participant" || ["Qualified", "Client Interview"].includes(c.stage) || ["Onboarding", "Active / Retention"].includes(c.stage)) && (
          <div className="my-1 border-t border-line" />
        )}
        {c.contact_type === "research_participant" && (
          <ActionButton variant="menu" url={`/api/contacts/${c.id}`} body={{ action: "convert" }} label="Convert to prospect"
            doneText={`${c.name} is now a prospect`} confirmText={`Turn ${c.name} into a prospect? Their research history stays.`} />
        )}
        {["Qualified", "Client Interview"].includes(c.stage) && <MoveButton variant="menu" contactId={c.id} name={c.name} to="onboarding" />}
        {c.stage === "Onboarding" && <MoveButton variant="menu" contactId={c.id} name={c.name} to="active" />}
        {c.stage === "Active / Retention" && <MoveButton variant="menu" contactId={c.id} name={c.name} to="churn" />}
      </MoreMenu>
      {open === "draft" && <DraftOutreachModal contactIds={[c.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={c} onClose={() => setOpen("")} />}
      {open === "interview" && <AddInterviewModal contact={c} aiEnabled={aiEnabled} onClose={() => setOpen("")} />}
    </div>
  );
}

/** Copy a value (e.g. an email) with a confirmation. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <button type="button" className="text-xs font-medium text-forest hover:underline"
      onClick={() => navigator.clipboard.writeText(value).then(() => toast("Copied"), () => toast("Couldn't copy"))}>
      {label}
    </button>
  );
}

/** "⋯" for a contact in a table row or list: Draft outreach, Log, Open. Hover-only with a mouse, always on touch. */
export function ContactRowMenu({ contact, testRedirect }: { contact: Record<string, string>; testRedirect?: string }) {
  const [open, setOpen] = useState<"" | "draft" | "log">("");
  return (
    <div className="flex justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      <MoreMenu label={`Actions for ${contact.name}`} width="w-44">
        <button className={MENU_ITEM} onClick={() => setOpen("draft")}>Draft outreach</button>
        <button className={MENU_ITEM} onClick={() => setOpen("log")}>Log interaction</button>
        <Link className={MENU_ITEM} href={`/contacts/${contact.id}`}>Open profile</Link>
      </MoreMenu>
      {open === "draft" && <DraftOutreachModal contactIds={[contact.id]} testRedirect={testRedirect} onClose={() => setOpen("")} />}
      {open === "log" && <LogInteractionModal contact={contact} onClose={() => setOpen("")} />}
    </div>
  );
}
