"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SITE_CONFIG } from "@/lib/target";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";

/** "Add site" / "Edit" button that opens the site form. Field labels come from config.json → sites. */
export function SiteButton({ organizationId, site, label = "+ Add site", small = false }: {
  organizationId: string; site?: Record<string, string>; label?: string; small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${small ? "btn-sm" : ""}`} onClick={() => setOpen(true)}>{label}</button>
      {open && <SiteModal organizationId={organizationId} site={site} onClose={() => setOpen(false)} />}
    </>
  );
}

function SiteModal({ organizationId, site, onClose }: { organizationId: string; site?: Record<string, string>; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(site || { status: SITE_CONFIG.statuses[0] || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <Modal title={site ? `Edit site · ${site.name}` : "Add site"} onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
          if (site) await postJson(`/api/sites/${site.id}`, v, "PATCH");
          else await postJson("/api/sites", { ...v, organization_id: organizationId });
          router.refresh();
          onClose();
        } catch (err) { setError((err as Error).message); setBusy(false); }
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Site name *</label>
            <input className="input" required value={v.name || ""} onChange={set("name")} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label>
            <input className="input" value={v.address || ""} onChange={set("address")} /></div>
          <div><label className="label">{SITE_CONFIG.sizeLabel}</label>
            <input className="input" inputMode="decimal" value={v.size || ""} onChange={set("size")} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={v.status || ""} onChange={set("status")}>
              {SITE_CONFIG.statuses.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div><label className="label">{SITE_CONFIG.serviceLabel}: start</label>
            <input className="input" type="date" value={v.service_start || ""} onChange={set("service_start")} /></div>
          <div><label className="label">{SITE_CONFIG.serviceLabel}: end</label>
            <input className="input" type="date" value={v.service_end || ""} onChange={set("service_end")} /></div>
          <div className="sm:col-span-2"><label className="label">{SITE_CONFIG.notesLabel}</label>
            <textarea className="input min-h-20" value={v.notes || ""} onChange={set("notes")} /></div>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{busy ? "Saving…" : site ? "Save site" : "Add site"}</button>
        </div>
      </form>
    </Modal>
  );
}
