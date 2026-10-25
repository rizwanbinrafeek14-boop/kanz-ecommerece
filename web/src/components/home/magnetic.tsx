"use client";
import * as React from "react";

/** Wraps a call-to-action so it drifts slightly towards the pointer. Off for touch screens and reduced motion. */
export function Magnetic({ children, strength = 0.25, max = 10 }: { children: React.ReactNode; strength?: number; max?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const on = React.useRef(false);
  React.useEffect(() => { on.current = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches; }, []);
  const move = (e: React.PointerEvent) => {
    if (!on.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect(); const c = (v: number) => Math.max(-max, Math.min(max, v));
    ref.current.style.transform = `translate(${c((e.clientX - r.left - r.width / 2) * strength)}px, ${c((e.clientY - r.top - r.height / 2) * strength)}px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };
  return <span ref={ref} onPointerMove={move} onPointerLeave={leave} className="inline-block transition-transform duration-200 ease-out will-change-transform">{children}</span>;
}
