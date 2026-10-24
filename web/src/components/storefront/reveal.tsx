"use client";
import * as React from "react";

/** Fades content up once when it scrolls into view. Renders visible immediately for reduced-motion users, without JS, and for crawlers. */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [armed, setArmed] = React.useState(false);   // true = hidden, waiting to be revealed
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) return;              // already on screen: don't flash
    setArmed(true);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`${className} ${armed && !shown ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"} motion-safe:transition-[opacity,transform] motion-safe:duration-500`}>{children}</div>;
}
