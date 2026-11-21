"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./Modal";
import { Spinner } from "./ui";
import { toast } from "./Toast";

type S = { assign_email: boolean; urgent_email: boolean; digest_email: boolean; digest_day: string };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only" />
      <span aria-hidden className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-forest" : "bg-line"} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-forest`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}

export function NotificationSettingsForm({ initial }: { initial: S }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof S) => (v: boolean | string) => { setS({ ...s, [k]: v }); setMsg(""); };
  const save = async () => {
    setBusy(true); setMsg("");
    try { await postJson("/api/settings/notifications", s); setMsg(""); toast("Notification settings saved"); router.refresh(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="divide-y divide-line border-y border-line">
        <Toggle label="Assignments" hint="When someone gives you a task or a client, or hands work off to you."
          checked={s.assign_email} onChange={set("assign_email")} />
        <Toggle label="Urgent tasks" hint="When a task of yours is marked Urgent, or is 3+ days overdue."
          checked={s.urgent_email} onChange={set("urgent_email")} />
        <Toggle label="Weekly digest" hint="Your open tasks, clients needing attention, survey responses, stage moves and pipeline."
          checked={s.digest_email} onChange={set("digest_email")} />
        <div className="flex items-center justify-between gap-6 py-3">
          <span>
            <span className="block text-sm font-medium text-ink">Digest day</span>
            <span className="block text-xs text-muted">Sent in the morning, Pacific time.</span>
          </span>
          <select className="input w-28" value={s.digest_day} disabled={!s.digest_email} onChange={(e) => set("digest_day")(e.target.value)} aria-label="Digest day">
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {msg && <span className={`text-sm ${msg === "Saved" ? "text-success" : "text-coral"}`}>{msg}</span>}
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />}Save</button>
      </div>
    </div>
  );
}

export function SendDigestNow({ testRedirect }: { testRedirect?: string }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ name: string; status: string }[] | null>(null);
  const [error, setError] = useState("");
  const send = async () => {
    if (!confirm(testRedirect ? `Send everyone's digest now? Test mode: they all go to ${testRedirect}.` : "Send everyone's weekly digest now, from your Gmail?")) return;
    setBusy(true); setError("");
    try { setResults((await postJson("/api/digest/send", {})).results); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      <button className="btn" disabled={busy} onClick={send}>{busy && <Spinner />}Send weekly digest now</button>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      {results && (
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {results.map((r) => <li key={r.name} className="flex justify-between gap-3 py-1.5"><span>{r.name}</span><span className="text-muted">{r.status}</span></li>)}
        </ul>
      )}
    </div>
  );
}

export function SenderPermission() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const show = async () => {
    if (!confirm("This shows a secret that lets this app send email as you. Only paste it into .env.local (and later your host's environment settings). Never share it or put it in git. Continue?")) return;
    try { setToken((await postJson("/api/settings/sender", {})).refreshToken); } catch (e) { setError((e as Error).message); }
  };
  return token ? (
    <div className="mt-2">
      <p className="text-xs text-muted">Add these two lines to <code>.env.local</code>, then restart the app. Then close this page.</p>
      <textarea readOnly className="input mt-1 h-20 font-mono text-xs" onFocus={(e) => e.target.select()}
        value={`NOTIFY_SENDER_EMAIL=<your email>\nNOTIFY_SENDER_REFRESH_TOKEN=${token}`} />
    </div>
  ) : (
    <div className="mt-2">
      <button className="btn btn-sm" onClick={show}>Use my account as the sender</button>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}
