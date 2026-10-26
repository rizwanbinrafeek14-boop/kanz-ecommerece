"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { Box, Eye, EyeOff, Pause, Play, Ruler, Layers } from "lucide-react";
import { useSelectedVariant } from "@/lib/variant-store";
import { useSelectedChoices } from "@/lib/config-store";
import type { DimensionTableRow } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils";

// the 3D view (three.js) is downloaded only when the customer asks for it
const Gasket3D = dynamic(() => import("./gasket-3d").then((m) => m.Gasket3D), { ssr: false, loading: () => <p className="p-6 text-sm text-muted-foreground">Loading 3D view…</p> });

export interface GasketDims { d1?: number; d2: number; d3: number; d4?: number }
type Style = "SW" | "SW-IR" | "SW-CR" | "SW-IR/CR";
const hasIR = (s: Style) => s === "SW-IR" || s === "SW-IR/CR";
const hasCR = (s: Style) => s === "SW-CR" || s === "SW-IR/CR";

const T = {
  en: { title: "Explore the spiral wound gasket", gasket: "Gasket layers", joint: "In the flange joint", explode: "Exploded view", labels: "Labels", dims: "Dimensions", play: "Animate", pause: "Pause", view3d: "View in 3D", hide3d: "Hide 3D",
    ir: "Inner ring", winding: "Sealing element: metal winding + filler", cr: "Centering (outer) ring", flange: "Flange (raised face)", bolt: "Bolt", groove: "Groove / recess locates the gasket",
    illustrative: "Illustrative — not to scale.", radial: "Ring widths follow the catalogue dimensions of the selected size; the distance to the centreline is shortened and thickness is exaggerated.",
    nominal: "No dimensions for this style in the catalogue (made to the joint): proportions are schematic.", jointNote: "Schematic: shows where the gasket sits and what locates it. It does not show compression, stress or sealing performance.",
    reduced: "Animation is off because your device asks for reduced motion.", selected: "Selected", choose: "Choose a configuration above to see its dimensions.", windingLbl: "Winding", fillerLbl: "Filler", irLbl: "Inner ring", crLbl: "Centering ring",
    desc: (s: string) => `Cross-section of a ${s} spiral wound gasket.` },
  ar: { title: "استكشف الجوان الحلزوني", gasket: "طبقات الجوان", joint: "داخل وصلة الفلنجة", explode: "عرض مفكك", labels: "التسميات", dims: "الأبعاد", play: "تحريك", pause: "إيقاف", view3d: "عرض ثلاثي الأبعاد", hide3d: "إخفاء العرض ثلاثي الأبعاد",
    ir: "الحلقة الداخلية", winding: "عنصر الإحكام: لف معدني + حشو", cr: "حلقة التوسيط (الخارجية)", flange: "فلنجة (وجه بارز)", bolt: "مسمار", groove: "المجرى / التجويف يحدد موضع الجوان",
    illustrative: "رسم توضيحي — ليس بمقياس رسم.", radial: "عروض الحلقات حسب أبعاد الكتالوج للمقاس المحدد؛ المسافة إلى المحور مختصرة والسماكة مكبّرة.",
    nominal: "لا توجد أبعاد لهذا النوع في الكتالوج (يُصنع حسب الوصلة): النسب تخطيطية.", jointNote: "تخطيطي: يوضح موضع الجوان وما يحدده، ولا يبيّن الانضغاط أو الإجهاد أو أداء الإحكام.",
    reduced: "الحركة متوقفة لأن جهازك يطلب تقليل الحركة.", selected: "المحدد", choose: "اختر التكوين أعلاه لعرض أبعاده.", windingLbl: "اللف", fillerLbl: "الحشو", irLbl: "الحلقة الداخلية", crLbl: "حلقة التوسيط",
    desc: (s: string) => `مقطع جوان حلزوني من النوع ${s}.` },
};

function usePrefersReducedMotion() {
  return React.useSyncExternalStore((cb) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}

/** Dimensions of the selected configuration, taken only from the dimension table row that applies to it. */
function dimsFor(tables: DimensionTableRow[], opts?: Record<string, string>): GasketDims | null {
  if (!opts) return null;
  const fits = (want: Record<string, string>) => Object.entries(want).every(([k, v]) => opts[k] === v);
  for (const t of tables) {
    if (!fits(t.applies)) continue;
    const r = t.rows.find((x) => fits(x.match)); if (!r) continue;
    const n = (k: string) => (r.values[k] != null && r.values[k] !== "" ? Number(r.values[k]) : undefined);
    if (n("d2") && n("d3")) return { d1: n("d1"), d2: n("d2")!, d3: n("d3")!, d4: n("d4") };
  }
  return null;
}

export function GasketExplorer({ tables, variants, lang, enable3d }: { tables: DimensionTableRow[]; variants: { id: string; options?: Record<string, string>; label: string }[]; lang: string; enable3d: boolean }) {
  const t = T[lang === "ar" ? "ar" : "en"]; const ar = lang === "ar";
  const vid = useSelectedVariant(); const v = variants.find((x) => x.id === vid);
  const style = ((v?.options?.style as Style) || "SW-IR/CR");
  const dims = dimsFor(tables, v?.options);
  const choices = useSelectedChoices();
  const reduced = usePrefersReducedMotion();
  const [view, setView] = React.useState<"gasket" | "joint">("gasket");
  const [exploded, setExploded] = React.useState(true);
  const [labels, setLabels] = React.useState(true);
  const [showDims, setShowDims] = React.useState(true);
  const [playing, setPlaying] = React.useState(false);
  const [phase, setPhase] = React.useState(false);   // animation state: assembled (gasket view) / tightened (joint view)
  const [show3d, setShow3d] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null); const [fz, setFz] = React.useState(12);
  React.useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const k = e.contentRect.width / 720; setFz(Math.min(30, Math.max(12, Math.round(12.5 / (k || 1))))); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  React.useEffect(() => { if (!playing || reduced) return; const id = setInterval(() => setPhase((x) => !x), 1800); return () => clearInterval(id); }, [playing, reduced]);

  const apart = view === "gasket" ? (playing ? !phase : exploded) : false;
  const tight = view === "joint" && (playing ? phase : !exploded);

  // radial layout: the band from the smallest to the largest diameter is drawn to scale across the width
  const nominal: GasketDims = { d1: hasIR(style) ? 80 : undefined, d2: 100, d3: 140, d4: hasCR(style) ? 190 : undefined };
  const d = dims ?? nominal;
  const r1 = hasIR(style) && d.d1 ? d.d1 / 2 : undefined, r2 = d.d2 / 2, r3 = d.d3 / 2, r4 = hasCR(style) && d.d4 ? d.d4 / 2 : undefined;
  const rMin = r1 ?? r2, rMax = r4 ?? r3;
  const X0 = 150, W = 470; const x = (r: number) => X0 + ((r - rMin) / (rMax - rMin || 1)) * W;
  const yC = 210, tw = 46, tr = 32;   // winding / ring heights (4.45 vs ~3.1 mm, in proportion to each other)
  const off = apart ? 78 : 0;
  const strips = Math.max(8, Math.min(40, Math.round((x(r3) - x(r2)) / 7)));
  const ink = "#1E1E20", red = "#B02221";

  const L = (key: string) => choices[key];
  const lblW = [t.windingLbl + (L("winding") ? `: ${L("winding")}` : ""), t.fillerLbl + (L("filler") ? `: ${L("filler")}` : "")].join(" · ");
  const lblIR = t.ir + (L("inner_ring") ? ` · ${L("inner_ring")}` : "");
  const lblCR = t.cr + (L("outer_ring") ? ` · ${L("outer_ring")}` : "");
  const fmt = (n?: number) => (n == null ? "" : n.toLocaleString("en", { maximumFractionDigits: 2 }));

  const winding = (
    <g data-part="winding" style={{ transform: `translateY(0px)` }}>
      <rect x={x(r2)} y={yC - (tight ? tr + 4 : tw) / 2} width={x(r3) - x(r2)} height={tight ? tr + 4 : tw} fill="#3b3c40" />
      {Array.from({ length: strips }, (_, i) => {
        const a = x(r2) + ((i + 0.5) * (x(r3) - x(r2))) / strips; const h = (tight ? tr + 4 : tw) / 2; const k = 4;
        return <polyline key={i} points={`${a - k},${yC - h + 2} ${a + k},${yC} ${a - k},${yC + h - 2}`} fill="none" stroke="#c9c8c9" strokeWidth={2.2} className="transition-all duration-700 motion-reduce:transition-none" />;
      })}
    </g>);
  const ringIR = r1 != null && <g data-part="inner-ring" className="transition-transform duration-700 motion-reduce:transition-none" style={{ transform: `translateY(${-off}px)` }}>
    <rect x={x(r1)} y={yC - tr / 2} width={x(r2) - x(r1)} height={tr} fill="url(#gx-steel)" stroke={ink} strokeWidth={1.2} /></g>;
  const ringCR = r4 != null && <g data-part="outer-ring" className="transition-transform duration-700 motion-reduce:transition-none" style={{ transform: `translateY(${off}px)` }}>
    <rect x={x(r3)} y={yC - tr / 2} width={x(r4) - x(r3)} height={tr} fill="url(#gx-cs)" stroke={ink} strokeWidth={1.2} /></g>;

  const dimLine = (r: number | undefined, val: number | undefined, name: string, y: number) => r == null || val == null ? null : (
    <g key={name} data-dim={name}>
      <line x1={60} x2={x(r)} y1={y} y2={y} stroke={red} strokeWidth={1} markerEnd="url(#gx-arrow)" />
      <line x1={x(r)} x2={x(r)} y1={y - 6} y2={yC + (y < yC ? -tr / 2 : tr / 2)} stroke={red} strokeWidth={0.6} strokeDasharray="3 3" />
      <text x={Math.max(70, x(r) - 8)} y={y - 4} textAnchor={x(r) - 8 > 70 + fz * 10 ? "end" : "start"} className="fill-[#B02221] font-semibold" style={{ fontFamily: "var(--font-mono, monospace)" }}>{name} = Ø {fmt(val)} mm</text>
    </g>);

  const describe = [t.desc(style), r1 != null ? t.ir : null, t.winding, r4 != null ? t.cr : null].filter(Boolean).join(". ") + "." +
    (dims ? ` ${[dims.d1 && hasIR(style) ? `d1 ${fmt(dims.d1)} mm` : "", `d2 ${fmt(dims.d2)} mm`, `d3 ${fmt(dims.d3)} mm`, dims.d4 && hasCR(style) ? `d4 ${fmt(dims.d4)} mm` : ""].filter(Boolean).join(", ")}.` : "");

  const btn = (on: boolean) => cn("inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-ink bg-ink text-white" : "border-steel-300 bg-white hover:border-primary");

  return (
    <section aria-labelledby="gx-h" className="rounded-xl border bg-card" data-gasket-explorer>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 id="gx-h" className="me-auto flex items-center gap-2 text-lg font-bold"><Layers className="size-5 text-primary" aria-hidden="true" />{t.title}</h2>
        <div role="tablist" aria-label={t.title} className="flex gap-1">
          {(["gasket", "joint"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={view === k} className={btn(view === k)} onClick={() => { setView(k); setPlaying(false); setExploded(k === "gasket"); }}>{k === "gasket" ? t.gasket : t.joint}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3" role="group" aria-label="Controls">
        <button type="button" aria-pressed={view === "gasket" ? exploded : !exploded} className={btn(view === "gasket" ? exploded : !exploded)} onClick={() => { setPlaying(false); setExploded((e) => !e); }}>{view === "gasket" ? t.explode : (ar ? "شدّ المسامير" : "Bolts tightened")}</button>
        <button type="button" aria-pressed={labels} className={btn(labels)} onClick={() => setLabels((l) => !l)}>{labels ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}{t.labels}</button>
        {view === "gasket" && <button type="button" aria-pressed={showDims} className={btn(showDims)} onClick={() => setShowDims((x) => !x)} disabled={!dims}><Ruler className="size-4" aria-hidden="true" />{t.dims}</button>}
        <button type="button" aria-pressed={playing} className={btn(playing)} onClick={() => setPlaying((p) => !p)} disabled={reduced} title={reduced ? t.reduced : undefined}>{playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}{playing ? t.pause : t.play}</button>
        {enable3d && <button type="button" aria-pressed={show3d} aria-controls={show3d ? "gx-3d" : undefined} className={cn(btn(show3d), "ms-auto")} onClick={() => setShow3d((s) => !s)}><Box className="size-4" aria-hidden="true" />{show3d ? t.hide3d : t.view3d}</button>}
      </div>
      <figure className="m-0 p-4">
        <svg ref={svgRef} viewBox="0 0 720 400" role="img" style={{ fontSize: fz }} aria-labelledby="gx-desc" className="h-auto w-full rounded-lg border bg-white" direction="ltr">
          <title id="gx-desc">{describe}</title>
          <defs>
            <linearGradient id="gx-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2F1F1" /><stop offset=".55" stopColor="#BDBBBC" /><stop offset="1" stopColor="#8E8C8D" /></linearGradient>
            <linearGradient id="gx-cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8d6d2" /><stop offset=".6" stopColor="#9f9a92" /><stop offset="1" stopColor="#77736c" /></linearGradient>
            <pattern id="gx-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#b9b7b8" strokeWidth="1.3" /></pattern>
            <marker id="gx-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={red} /></marker>
          </defs>
          {/* centreline + break (distance to the axis shortened) */}
          <line x1={60} x2={60} y1={30} y2={385} stroke={red} strokeWidth={1} strokeDasharray="14 4 3 4" />
          <text x={66} y={44} className="fill-[#B02221] text-[13px]">℄</text>
          <path d={`M95,${yC - 60} l10,-8 l10,16 l10,-8 M95,${yC + 60} l10,-8 l10,16 l10,-8`} stroke="#8E8C8D" fill="none" strokeWidth={1.2} />

          {view === "joint" && (
            <g data-view="joint">
              {/* upper and lower flange: raised-face joint for centering-ring styles, recess (groove) for styles located by the joint */}
              {[-1, 1].map((sgn) => {
                // raised face (RF) over the sealing element; the centering ring sits in the space between the flange bodies
                const rf = 16; const gap = tight ? (tr + 4) / 2 : tw / 2 + 6; const xEnd = (r4 != null ? x(r4) + 70 : x(r3) + 70); const xRF = r4 != null ? x(r3) + 8 : xEnd;
                const face = sgn < 0 ? yC - gap : yC + gap; const body = sgn < 0 ? face - (r4 != null ? rf : 0) : face + (r4 != null ? rf : 0);
                const pts = sgn < 0
                  ? `60,${body - 110} ${xEnd},${body - 110} ${xEnd},${body} ${xRF},${body} ${xRF},${face} 60,${face}`
                  : `60,${face} ${xRF},${face} ${xRF},${body} ${xEnd},${body} ${xEnd},${body + 110} 60,${body + 110}`;
                return <g key={sgn}>
                  <polygon points={pts} fill="url(#gx-hatch)" stroke={ink} strokeWidth={1.2} className="transition-all duration-700 motion-reduce:transition-none" />
                  {r4 == null && sgn > 0 && <rect x={x(rMin) - 3} y={face} width={x(r3) - x(rMin) + 6} height={12} fill="#fff" stroke={ink} strokeWidth={1} />}
                </g>; })}
              {r4 != null && <g data-part="bolt">
                <rect x={x(r4) + 18} y={yC - 170} width={22} height={340} fill="url(#gx-steel)" stroke={ink} strokeWidth={1} />
                {labels && <text x={x(r4) + 46} y={yC - 150} className="fill-[#1E1E20] font-semibold">{t.bolt}</text>}
              </g>}
              {labels && <text x={70} y={yC - 145} className="fill-[#1E1E20] font-semibold">{r4 != null ? t.flange : t.groove}</text>}
            </g>)}

          {ringIR}{winding}{ringCR}

          {labels && view === "gasket" && fz <= 18 && <g className="font-semibold" data-labels>
            {r1 != null && <text x={x(r1)} y={yC - tr / 2 - off - 10} className="fill-[#1E1E20]">{lblIR}</text>}
            <text x={x(r2)} y={yC + tw / 2 + (r4 != null && apart ? 18 : 22)} className="fill-[#1E1E20]">{lblW}</text>
            {r4 != null && <text x={Math.min(x(r3), 470)} y={yC + tr / 2 + off + 20} className="fill-[#1E1E20]">{lblCR}</text>}
          </g>}

          {view === "gasket" && showDims && dims && <g data-dims>
            {dimLine(r1, hasIR(style) ? dims.d1 : undefined, "d1", 20 + fz * 1.2)}
            {dimLine(r2, dims.d2, "d2", 20 + fz * 2.5)}
            {dimLine(r3, dims.d3, "d3", 392 - fz * 1.6)}
            {dimLine(r4, hasCR(style) ? dims.d4 : undefined, "d4", 392 - fz * 0.3)}
          </g>}
        </svg>
        <figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p><strong className="text-foreground">{t.illustrative}</strong> {view === "joint" ? t.jointNote : dims ? t.radial : t.nominal}</p>
          {reduced && <p>{t.reduced}</p>}
          {labels && (view === "joint" || fz > 18) && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-foreground" data-legend>{[r1 != null ? lblIR : null, lblW, r4 != null ? lblCR : null].filter(Boolean).map((l) => <li key={l!}>• {l}</li>)}</ul>}
          <p className="text-foreground" aria-live="polite">{v ? `${t.selected}: ${v.label}` : t.choose}</p>
        </figcaption>
      </figure>
      {enable3d && show3d && <div id="gx-3d" className="border-t p-4"><Gasket3D dims={dims} style={style} lang={lang} reduced={reduced} /></div>}
    </section>
  );
}
