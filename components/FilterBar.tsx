"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PIPELINE_STAGES, RESEARCH_STATUSES } from "@/lib/data/schema";

type Extra = { name: string; label: string; options: string[] };

/**
 * Stage / Owner filters, plus search. State lives in the URL so links are shareable.
 * Search stays out of the way: a small round button in the bottom-right corner (or press "/"),
 * which opens a compact field there. It stays open while a search is active.
 */
export function FilterBar({ owners, show = ["stage", "owner"], extra = [], stages }: {
  owners: string[]; show?: ("stage" | "owner")[]; extra?: Extra[]; stages?: readonly string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [searching, setSearching] = useState(!!sp.get("q"));
  // "/" opens search (unless you're already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); setSearching(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
  const filters = show.includes("stage") || (show.includes("owner") && owners.length > 0) || extra.length > 0;
  return (<>
    {/* Search: bottom-right corner, out of the way */}
    <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
      {searching ? (
        <span className="flex items-center gap-1 border border-line bg-white p-1">
          <input autoFocus className="w-56 max-w-[60vw] bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-faint" placeholder="Search name, organization…" aria-label="Search"
            defaultValue={sp.get("q") || ""} onChange={(e) => set("q", e.target.value)}
            onBlur={(e) => !e.target.value && setSearching(false)}
            onKeyDown={(e) => e.key === "Escape" && (set("q", ""), setSearching(false))} />
          <button type="button" className="px-1.5 text-lg leading-none text-muted hover:text-ink" aria-label="Close search"
            onMouseDown={(e) => e.preventDefault()} onClick={() => { set("q", ""); setSearching(false); }}>×</button>
        </span>
      ) : (
        <button type="button" onClick={() => setSearching(true)} aria-label="Search (press /)" title="Search (press /)"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-muted transition-colors hover:border-muted/50 hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
    {filters && <div className="mb-4 flex flex-wrap items-center gap-2">
      {show.includes("stage") && select("stage", "All stages", stages || [...PIPELINE_STAGES, ...RESEARCH_STATUSES.filter((s) => s !== "Survey Completed")])}
      {show.includes("owner") && select("owner", "All owners", owners)}
      {extra.map((x) => select(x.name, x.label, x.options))}
    </div>}
  </>);
}
