"use client";

// The bell at the top of the sidebar: an unread dot, and a list of your notifications (newest first).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isTrue, timeAgo } from "@/lib/util";
import { postJson } from "./Modal";

export type BellItem = { id: string; title: string; link: string; by: string; read: string; created_at: string; type: string };

export function Bell({ items = [] }: { items?: BellItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  // The sidebar scrolls (and so clips), so the list floats above the page at the bell's position.
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left, window.innerWidth - 336)) });
    setOpen(!open);
  };
  const [list, setList] = useState(items);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setList(items), [items]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const unread = list.filter((n) => !isTrue(n.read)).length;
  const go = (n: BellItem) => {
    setOpen(false);
    if (!isTrue(n.read)) {
      setList((l) => l.map((x) => (x.id === n.id ? { ...x, read: "TRUE" } : x)));
      postJson("/api/notifications", { id: n.id }).catch(() => {});
    }
    router.push(n.link || "/");
  };
  const markAll = async () => {
    setList((l) => l.map((x) => ({ ...x, read: "TRUE" })));
    await postJson("/api/notifications", {}).catch(() => {});
    router.refresh();
  };

  return (
    <div ref={box} className="relative">
      <button ref={btn} type="button" onClick={toggle} aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-wash hover:text-ink">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-current text-urgent ring-2 ring-paper" aria-hidden />}
      </button>

      {open && (
        <div className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] border border-line bg-white" style={{ top: pos.top, left: pos.left }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications{unread ? ` · ${unread} new` : ""}</span>
            <button type="button" onClick={markAll} disabled={!unread}
              className="text-xs font-medium text-info hover:underline disabled:text-faint disabled:no-underline">Mark all read</button>
          </div>
          {list.length ? (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {list.map((n) => {
                const isNew = !isTrue(n.read);
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => go(n)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isNew ? (n.type === "urgent" ? "bg-coral" : "bg-forest") : "bg-transparent"}`} aria-hidden />
                      <span className="min-w-0">
                        <span className={`block text-sm ${isNew ? "font-medium text-ink" : "text-muted"}`}>{n.title}</span>
                        <span className="block text-xs text-faint">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-4 py-6 text-center text-sm text-muted">No notifications yet.</p>}
        </div>
      )}
    </div>
  );
}
