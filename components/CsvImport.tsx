"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { Spinner } from "./ui";

type Check = { row: Record<string, string>; status: "new" | "duplicate" | "invalid"; reason?: string; existingId?: string };

const STATUS = {
  new: { label: "New", cls: "text-forest" },
  duplicate: { label: "Duplicate · skipped", cls: "text-muted" },
  invalid: { label: "Missing name · skipped", cls: "text-coral" },
};

/** Step 1: pick a CSV and check it (nothing saved). Step 2: import only the new rows. */
export function CsvImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fresh = checks?.filter((c) => c.status === "new").length || 0;

  const check = async (text: string) => {
    setBusy(true); setError(""); setChecks(null); setResult(null);
    try {
      const r = await postJson("/api/contacts/import", { csv: text, dryRun: true });
      setChecks(r.checks); setIgnored(r.ignoredColumns || []);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const doImport = async () => {
    setBusy(true); setError("");
    try { setResult(await postJson("/api/contacts/import", { csv, dryRun: false })); setChecks(null); router.refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="border border-line bg-white p-6">
        <p className="text-lg font-bold">Imported {result.created} contact{result.created === 1 ? "" : "s"}.</p>
        <p className="muted mt-1">{result.skipped} row{result.skipped === 1 ? " was" : "s were"} skipped (duplicates or missing a name).</p>
        <div className="mt-5 flex gap-2">
          <Link href="/contacts" className="btn btn-primary">See all contacts</Link>
          <button className="btn" onClick={() => { setResult(null); setCsv(""); setFileName(""); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-line bg-white p-5 sm:p-6">
        <label className="label" htmlFor="csv-file">CSV file</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" className="input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            setCsv(text); setFileName(f.name);
            check(text);
          }} />
        <p className="mt-2 text-xs text-muted">
          The first row must be headers. Recognized: name, email, organization, role, phone, linkedin, source, contact_type,
          stage, research_status, owner, fit_score, next_followup_date, quote_amount, deal_value, expected_close_date, deal_status, notes.
          Tip: export first to get a template.
        </p>
        {busy && !checks && <p className="mt-3 text-sm text-muted"><Spinner /> Checking {fileName}…</p>}
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      </div>

      {checks && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2">
            <h2 className="h2">Preview · {checks.length} rows · {fresh} new</h2>
            <button className="btn btn-primary" disabled={!fresh || busy} onClick={doImport}>
              {busy && <Spinner />}Import {fresh} new contact{fresh === 1 ? "" : "s"}
            </button>
          </div>
          {ignored.length > 0 && <p className="mb-3 text-xs text-muted">Columns not imported: {ignored.join(", ")}</p>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Organization</th><th>Result</th></tr></thead>
              <tbody>
                {checks.map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium">{c.row.name || <span className="text-faint">—</span>}</td>
                    <td className="max-w-[16rem] truncate text-muted" title={c.row.email}>{c.row.email || "—"}</td>
                    <td className="text-muted">{c.row.company || "—"}</td>
                    <td className={`text-xs font-semibold ${STATUS[c.status].cls}`}>
                      {STATUS[c.status].label}
                      {c.reason && <div className="font-normal text-muted">
                        {c.existingId ? <Link href={`/contacts/${c.existingId}`} className="hover:underline">{c.reason}</Link> : c.reason}
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
