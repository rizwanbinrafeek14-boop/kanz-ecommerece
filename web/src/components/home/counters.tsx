"use client";
import * as React from "react";

/** Real database counts, counted up once when visible. Reduced motion or no IntersectionObserver: final values immediately. */
export function Counters({ items, lang }: { items: { value: number; label: string }[]; lang: "en" | "ar" }) {
  const ref = React.useRef<HTMLDListElement>(null);
  const [k, setK] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    setK(0);
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return; io.disconnect();
      const t0 = performance.now(); const step = (t: number) => { const x = Math.min(1, (t - t0) / 900); setK(1 - Math.pow(1 - x, 3)); if (x < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    });
    io.observe(el); return () => io.disconnect();
  }, []);
  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US");
  if (!items.length) return null;
  return (
    <dl ref={ref} className="flex flex-wrap divide-x divide-steel-300 border-y border-steel-300 rtl:divide-x-reverse">
      {items.map((it) => (
        <div key={it.label} className="flex min-w-[7.5rem] flex-1 flex-col gap-0.5 px-4 py-3 first:ps-0">
          <dd className="order-1 font-mono text-2xl font-medium tabular-nums text-foreground sm:text-3xl" aria-hidden={k < 1 ? true : undefined}>{fmt.format(Math.round(it.value * k))}</dd>
          <dt className="spec-label order-2 text-steel-600">{it.label}<span className="sr-only">: {fmt.format(it.value)}</span></dt>
        </div>))}
    </dl>
  );
}
