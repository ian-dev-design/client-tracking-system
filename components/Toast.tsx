"use client";

// Short confirmation after an action ("Moved to Onboarding"). Call toast("…") from any client component.

import { useEffect, useState } from "react";

const EVENT = "crm-toast";
export const toast = (message: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg({ text: (e as CustomEvent<string>).detail, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer); };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      {msg && (
        <div key={msg.id} className="flex items-center gap-2 bg-ink px-4 py-2.5 text-sm text-paper">
          <span className="text-sage" aria-hidden>✓</span>{msg.text}
        </div>
      )}
    </div>
  );
}
