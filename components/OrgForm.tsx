"use client";

import { toast } from "./Toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { target } from "@/lib/target";
import { Modal, postJson } from "./Modal";
import { Spinner } from "./ui";

/** "Add organization" / "Edit" button with its form. Types come from config.json → targetCustomer.customerTypes. */
export function OrgButton({ org, label = "+ Add organization", primary = false }: {
  org?: Record<string, string>; label?: string; primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={() => setOpen(true)}>{label}</button>
      {open && <OrgModal org={org} onClose={() => setOpen(false)} />}
    </>
  );
}

function OrgModal({ org, onClose }: { org?: Record<string, string>; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(org || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const types = [...target.customerTypes, "Other"];

  return (
    <Modal title={org ? `Edit · ${org.name}` : "Add organization"} onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
          const saved = org ? await postJson(`/api/organizations/${org.id}`, v, "PATCH") : await postJson("/api/organizations", v);
          if (!org) router.push(`/organizations/${saved.id}`);
          toast("Organization saved");
          router.refresh();
          onClose();
        } catch (err) { setError((err as Error).message); setBusy(false); }
      }}>
        <div><label className="label">Name *</label><input className="input" required value={v.name || ""} onChange={set("name")} /></div>
        <div><label className="label">Type</label>
          <select className="input" value={v.type || ""} onChange={set("type")}>
            <option value="">—</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div><label className="label">Address</label><input className="input" value={v.address || ""} onChange={set("address")} /></div>
        <div><label className="label">Notes</label><textarea className="input min-h-20" value={v.notes || ""} onChange={set("notes")} /></div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{busy ? "Saving…" : org ? "Save" : "Add organization"}</button>
        </div>
      </form>
    </Modal>
  );
}
