"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CONTACT_TYPES, PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data/schema";

type Extra = { name: string; label: string; options: string[] };

/** Search + Stage / Type / Owner filters. State lives in the URL so links are shareable. */
export function FilterBar({ owners, show = ["stage", "type", "owner"], extra = [], stages }: {
  owners: string[]; show?: ("stage" | "type" | "owner")[]; extra?: Extra[]; stages?: readonly string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${path}?${next.toString()}`);
  };
  const select = (name: string, label: string, options: readonly string[]) => (
    <select key={name} className="input w-auto" value={sp.get(name) || ""} onChange={(e) => set(name, e.target.value)}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o.replaceAll("_", " ")}</option>)}
    </select>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        className="input max-w-xs"
        placeholder="Search name, organization, email…"
        defaultValue={sp.get("q") || ""}
        onChange={(e) => set("q", e.target.value)}
      />
      {show.includes("stage") && select("stage", "All stages", stages || [...PIPELINE_STAGES, ...RESEARCH_STATUSES.filter((s) => s !== "Survey Completed")])}
      {show.includes("type") && select("type", "All types", CONTACT_TYPES)}
      {show.includes("owner") && select("owner", "All owners", owners)}
      {extra.map((x) => select(x.name, x.label, x.options))}
    </div>
  );
}
