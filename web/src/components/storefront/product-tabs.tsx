"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Accessible tabs whose panels are all in the server-rendered HTML (inactive ones are only hidden), so crawlers see every tab. */
export function ProductTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = React.useState(tabs[0]?.id);
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return; e.preventDefault();
    const dir = document.documentElement.dir === "rtl" ? -d : d; const n = tabs[(i + dir + tabs.length) % tabs.length].id; setActive(n); refs.current[n]?.focus();
  };
  if (!tabs.length) return null;
  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-steel-200 no-scrollbar">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} id={`tab-${t.id}`} role="tab" type="button" aria-selected={active === t.id} aria-controls={`panel-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cn("relative min-h-11 whitespace-nowrap px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active === t.id ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "text-steel-600 hover:text-foreground")}>{t.label}</button>))}
      </div>
      {tabs.map((t) => <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="pt-6">{t.content}</div>)}
    </div>
  );
}
