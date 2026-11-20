"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { Spinner } from "./ui";
import { CONTACT_TYPES, DEAL_STATUSES, PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data/schema";

type Values = Record<string, string>;

const TYPE_LABEL: Record<string, string> = {
  prospect: "Prospect (potential customer)", research_participant: "Research participant", both: "Both",
};

/** Add / edit a contact. Typing an organization name links it (or creates it if it's new). */
export function ContactForm({ initial, owners, organizations, defaultOwner }: {
  initial?: Values; owners: string[]; organizations: string[]; defaultOwner: string;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [v, setV] = useState<Values>({ contact_type: "prospect", owner: defaultOwner, ...initial });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const field = (k: string, label: string, type = "text", required = false, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`f-${k}`}>{label}{required && " *"}</label>
      <input id={`f-${k}`} className="input" type={type} required={required} value={v[k] || ""} onChange={set(k)} {...extra} />
    </div>
  );
  const select = (k: string, label: string, options: readonly string[], fallback: string, labels: Record<string, string> = {}) => (
    <div>
      <label className="label" htmlFor={`f-${k}`}>{label}</label>
      <select id={`f-${k}`} className="input" value={v[k] || fallback} onChange={set(k)}>
        {options.map((o) => <option key={o} value={o}>{labels[o] || o}</option>)}
      </select>
    </div>
  );
  const section = (title: string, children: React.ReactNode) => (
    <fieldset className="border-t border-line pt-5">
      <legend className="eyebrow pr-3">{title}</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
  const prospect = v.contact_type !== "research_participant";
  const research = v.contact_type !== "prospect";

  return (
    <form
      className="max-w-3xl space-y-6 border border-line bg-white p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
          const saved = editing
            ? await postJson(`/api/contacts/${initial!.id}`, v, "PATCH")
            : await postJson("/api/contacts", v);
          router.push(`/contacts/${saved.id}`);
          router.refresh();
        } catch (err) { setError((err as Error).message); setBusy(false); }
      }}
    >
      {section("Contact", <>
        {field("name", "Name", "text", true)}
        <div>
          <label className="label" htmlFor="f-company">Organization</label>
          <input id="f-company" className="input" list="organizations" value={v.company || ""} onChange={set("company")}
            placeholder="Pick one or type a new name" />
          <datalist id="organizations">{organizations.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        {field("role", "Role")}
        {field("email", "Email", "email")}
        {field("phone", "Phone", "tel")}
        {field("linkedin", "LinkedIn")}
        {field("source", "Source (where you found them)")}
      </>)}

      {section("Journey", <>
        {select("contact_type", "Type *", CONTACT_TYPES, "prospect", TYPE_LABEL)}
        {prospect && select("stage", "Stage", PIPELINE_STAGES, "Lead")}
        {research && select("research_status", "Research status", RESEARCH_STATUSES, "To Contact")}
        <div>
          <label className="label" htmlFor="f-owner">Owner</label>
          <input id="f-owner" className="input" list="owners" value={v.owner || ""} onChange={set("owner")} />
          <datalist id="owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        {select("fit_score", "Fit score (1–5)", ["", "1", "2", "3", "4", "5"], "", { "": "—" })}
        {field("next_followup_date", "Next follow-up (default: 4 days)", "date")}
        {v.stage === "Churned / Lost" && field("lost_reason", "Reason lost")}
      </>)}

      {prospect && section("Deal", <>
        {field("deal_value", "Deal value ($)", "text", false, { inputMode: "decimal", placeholder: "e.g. 12000" })}
        {field("quote_amount", "Quote amount ($)", "text", false, { inputMode: "decimal" })}
        {field("expected_close_date", "Expected close date", "date")}
        {select("deal_status", "Won / lost", DEAL_STATUSES, "open", { open: "Open", won: "Won", lost: "Lost" })}
      </>)}

      <fieldset className="border-t border-line pt-5">
        <legend className="eyebrow pr-3">Notes</legend>
        <textarea aria-label="Notes" className="input mt-3 min-h-24" value={v.notes || ""} onChange={set("notes")} />
      </fieldset>

      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 border-t border-line pt-5">
        <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{busy ? "Saving…" : editing ? "Save changes" : "Add contact"}</button>
        <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
