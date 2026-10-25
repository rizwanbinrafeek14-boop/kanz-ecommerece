"use client";
import * as React from "react";

export interface DrawingLabels { neck: string; gasket: string; bolt: string; face: string; od: string; title: string; scale: string; sheet: string }

/**
 * Engineering line drawing of a flanged joint (pipe · weld-neck flange · gasket · flange · pipe) in side elevation.
 * Draws itself on load, then opens into an exploded view as the visitor scrolls. Language-neutral, so it is not mirrored in Arabic.
 * Reduced motion: drawn instantly, shown half-open, not linked to scrolling.
 */
export function FlangeDrawing({ labels }: { labels: DrawingLabels }) {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = (p: number) => el.style.setProperty("--gap", `${(p * 64).toFixed(1)}px`);   // written straight to CSS: no React re-render while scrolling
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { set(0.5); return; }
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => set(Math.min(1, 0.2 + window.scrollY / 520))); };
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  const mv = (k: number) => ({ transform: `translateX(calc(var(--gap) * ${k}))` });
  const S = "var(--steel-700)", R = "var(--primary)", F = "var(--steel-400)";
  const t = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", fill: "var(--steel-600)" } as const;
  return (
    <svg viewBox="0 0 560 350" role="img" aria-label={labels.title} ref={ref} className="draw h-auto w-full overflow-visible" style={{ direction: "ltr", ["--gap" as string]: "12.8px" }}>
      <line className="nodraw" x1="8" y1="170" x2="552" y2="170" stroke={F} strokeWidth="1" style={{ strokeDasharray: "16 4 2 4" }} />
      <g fill="none" stroke={S} strokeWidth="1.6" strokeLinejoin="round">
        <path pathLength={1} d="M20 130 H150 M20 210 H150 M20 130 V210" />
        <path pathLength={1} className="d2" d="M150 130 L196 116 V224 L150 210 Z" />
        <path pathLength={1} className="d2" d="M196 70 H228 V270 H196 Z" />
        <path pathLength={1} className="d3" d="M228 104 H234 V236 H228" />
        <path pathLength={1} className="d4" d="M184 82 h12 v14 h-12 Z M184 244 h12 v14 h-12 Z" strokeWidth="1.2" />
      </g>
      <g style={mv(0.5)} fill="none" stroke={R} strokeWidth="1.6">
        <path pathLength={1} className="d3" d="M240 106 H248 V234 H240 Z" />
      </g>
      <g style={mv(0.5)} stroke={F} strokeWidth="1">
        <line className="nodraw" x1="176" y1="89" x2="312" y2="89" style={{ strokeDasharray: "3 3" }} /><line className="nodraw" x1="176" y1="251" x2="312" y2="251" style={{ strokeDasharray: "3 3" }} />
      </g>
      <g style={mv(1)} fill="none" stroke={S} strokeWidth="1.6" strokeLinejoin="round">
        <path pathLength={1} className="d3" d="M260 104 H254 V236 H260" />
        <path pathLength={1} className="d2" d="M260 70 H292 V270 H260 Z" />
        <path pathLength={1} className="d2" d="M292 116 L338 130 V210 L292 224 Z" />
        <path pathLength={1} d="M338 130 H470 M338 210 H470 M470 130 V210" />
        <path pathLength={1} className="d4" d="M292 82 h12 v14 h-12 Z M292 244 h12 v14 h-12 Z" strokeWidth="1.2" />
      </g>
      {/* OD dimension */}
      <g stroke={R} strokeWidth="1" fill="none">
        <path pathLength={1} className="d4" d="M150 70 H190 M150 270 H190 M160 70 V270" />
        <path className="nodraw" style={{ strokeDasharray: "none" }} d="M156 81 L160 70 L164 81 M156 259 L160 270 L164 259" />
      </g>
      <text x="154" y="128" style={{ ...t, fill: "var(--primary)" }} textAnchor="end">{labels.od}</text>
      {/* leaders and callouts */}
      <g stroke={F} strokeWidth="1" fill="none">
        <path className="nodraw" style={{ strokeDasharray: "none" }} d="M172 120 L128 54 H36" />
        <path className="nodraw" style={{ ...mv(0.5), strokeDasharray: "none" }} d="M244 106 L268 38 H352" />
        <path className="nodraw" style={{ ...mv(1), strokeDasharray: "none" }} d="M304 92 L388 62 H520" />
        <path className="nodraw" style={{ strokeDasharray: "none" }} d="M232 236 L204 314 H48" />
      </g>
      <text x="36" y="48" style={t}>{labels.neck.toUpperCase()}</text>
      <g style={mv(0.5)}><text x="270" y="31" style={{ ...t, fill: "var(--primary)" }}>{labels.gasket.toUpperCase()}</text></g>
      <g style={mv(1)}><text x="520" y="55" style={t} textAnchor="end">{labels.bolt.toUpperCase()}</text></g>
      <text x="48" y="330" style={t}>{labels.face.toUpperCase()}</text>
    </svg>
  );
}
