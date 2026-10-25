"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Sticky numbered index of the homepage sections (desktop only), highlighting the section in view. */
export function SectionRail({ items, label }: { items: { id: string; num: string; label: string }[]; label: string }) {
  const [active, setActive] = React.useState(items[0]?.id);
  React.useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, { rootMargin: "-30% 0px -60% 0px" });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  if (items.length < 3) return null;
  return (
    <nav aria-label={label} className="sticky top-40 hidden self-start xl:block">
      <p className="spec-label mb-3 text-steel-500">{label}</p>
      <ol className="space-y-0.5 border-s border-steel-200">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? "true" : undefined}
              className={cn("-ms-px flex min-h-9 items-center gap-2 border-s-2 border-transparent ps-3 text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active === i.id ? "border-primary font-medium text-foreground" : "text-steel-500")}>
              <span className="font-mono text-xs tabular-nums">{i.num}</span>{i.label}
            </a>
          </li>))}
      </ol>
    </nav>
  );
}
