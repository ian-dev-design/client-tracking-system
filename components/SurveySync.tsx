"use client";

import { Spinner } from "./ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const FIVE_MIN = 5 * 60 * 1000;

async function runSync() {
  const res = await fetch("/api/surveys/sync", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync failed");
  return data as { matched: number; unmatched: number };
}

/** Polls for new Google Form responses every 5 minutes while the app is open. */
export function SurveyAutoSync() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => runSync().then((r) => r.matched > 0 && router.refresh()).catch(() => {});
    tick();
    const id = setInterval(tick, FIVE_MIN);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

export function SyncNowButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await runSync();
            setMsg(`${r.matched} new matched · ${r.unmatched} unmatched`);
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Spinner />}{busy ? "Syncing…" : "Sync surveys now"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
