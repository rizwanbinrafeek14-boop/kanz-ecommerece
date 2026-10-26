"use client";
import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Scissors, Expand, Home } from "lucide-react";
import type { GasketDims } from "./gasket-explorer";

type Style = "SW" | "SW-IR" | "SW-CR" | "SW-IR/CR";
const T = {
  en: { reset: "Reset view", left: "Rotate left", right: "Rotate right", zin: "Zoom in", zout: "Zoom out", cut: "Cutaway", explode: "Exploded", noGl: "3D needs WebGL, which this browser does not provide. The drawing above shows the same parts.",
    note: (k: number, real: boolean) => `Schematic 3D model. ${real ? "Diameters from the catalogue dimensions of the selected size" : "Proportions are schematic (no catalogue dimensions for this selection)"}; ${k > 1 ? `thickness exaggerated ×${k}; ` : ""}the winding pattern is illustrative. Drag to rotate, scroll or pinch to zoom.`,
    aria: "3D model of the spiral wound gasket. Use the buttons below to rotate, zoom, cut away or explode the model." },
  ar: { reset: "إعادة العرض", left: "تدوير لليسار", right: "تدوير لليمين", zin: "تكبير", zout: "تصغير", cut: "مقطع", explode: "مفكك", noGl: "يتطلب العرض ثلاثي الأبعاد WebGL غير المتوفر في هذا المتصفح. الرسم أعلاه يوضح الأجزاء نفسها.",
    note: (k: number, real: boolean) => `نموذج ثلاثي الأبعاد تخطيطي. ${real ? "الأقطار من أبعاد الكتالوج للمقاس المحدد" : "النسب تخطيطية"}؛ ${k > 1 ? `السماكة مكبّرة ×${k}؛ ` : ""}نمط اللف توضيحي.`,
    aria: "نموذج ثلاثي الأبعاد للجوان الحلزوني. استخدم الأزرار للتدوير والتكبير والمقطع والتفكيك." },
};

/** A ring (annulus with thickness) as a lathe solid, in millimetres. */
function ring(rIn: number, rOut: number, h: number, phi: number) {
  const pts = [new THREE.Vector2(rIn, -h / 2), new THREE.Vector2(rOut, -h / 2), new THREE.Vector2(rOut, h / 2), new THREE.Vector2(rIn, h / 2), new THREE.Vector2(rIn, -h / 2)];
  return new THREE.LatheGeometry(pts, 96, 0, phi);
}

export function Gasket3D({ dims, style, lang, reduced }: { dims: GasketDims | null; style: Style; lang: string; reduced: boolean }) {
  const t = T[lang === "ar" ? "ar" : "en"];
  const host = React.useRef<HTMLDivElement>(null);
  const api = React.useRef<{ rotate: (a: number) => void; zoom: (f: number) => void; reset: () => void; explode: (on: boolean) => void } | null>(null);
  const explodeRef = React.useRef(false);
  const [cut, setCut] = React.useState(true);
  const [explode, setExplode] = React.useState(false);
  // client-only component (loaded with ssr: false), so WebGL support can be checked up front
  const [noGl, setNoGl] = React.useState(() => { try { const c = document.createElement("canvas"); return !(c.getContext("webgl2") || c.getContext("webgl")); } catch { return true; } });
  const real = !!dims;
  const ir = style === "SW-IR" || style === "SW-IR/CR", cr = style === "SW-CR" || style === "SW-IR/CR";
  const d = dims ?? { d1: 80, d2: 100, d3: 140, d4: 190 };
  const od = (cr && d.d4 ? d.d4 : d.d3);
  const k = Math.max(1, Math.round((od * 0.04) / 4.45));   // keep the 4.45 mm winding visible on large diameters

  React.useEffect(() => {
    const el = host.current; if (!el || noGl) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { queueMicrotask(() => setNoGl(true)); return; }
    const w = el.clientWidth, h = Math.max(280, Math.round(w * 0.55));
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(w, h); el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, od / 100, od * 20);
    const home = new THREE.Vector3(od * 0.9, od * 0.75, od * 1.1);
    camera.position.copy(home);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(od, od * 2, od); scene.add(sun);

    const phi = cut ? Math.PI * 1.5 : Math.PI * 2;
    const steel = new THREE.MeshStandardMaterial({ color: 0xbdbbbc, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
    const cs = new THREE.MeshStandardMaterial({ color: 0x8f8a82, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide });
    const filler = new THREE.MeshStandardMaterial({ color: 0x35363a, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide });
    const group = new THREE.Group(); scene.add(group);
    const tw = 4.45 * k, trh = 3.15 * k;
    const parts: { mesh: THREE.Mesh; dy: number }[] = [];
    const add = (g: THREE.BufferGeometry, m: THREE.Material, dy: number) => { const mesh = new THREE.Mesh(g, m); group.add(mesh); parts.push({ mesh, dy }); };
    if (ir && d.d1) add(ring(d.d1 / 2, d.d2 / 2, trh, phi), steel, tw * 2.2);
    const bands = 14; const step = (d.d3 - d.d2) / 2 / bands;
    for (let i = 0; i < bands; i++) add(ring(d.d2 / 2 + i * step, d.d2 / 2 + (i + 1) * step, tw, phi), i % 2 ? filler : steel, 0);
    if (cr && d.d4) add(ring(d.d3 / 2, d.d4 / 2, trh, phi), cs, -tw * 2.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.minDistance = od * 0.3; controls.maxDistance = od * 5;
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);   // render on demand only — no background loop

    let raf = 0;
    const setExploded = (on: boolean) => {
      cancelAnimationFrame(raf);
      const target = on ? 1 : 0; const from = (group.userData.e as number) ?? 0;
      if (reduced) { group.userData.e = target; parts.forEach((p) => (p.mesh.position.y = p.dy * target)); render(); return; }
      const t0 = performance.now();
      const tick = (now: number) => { const a = Math.min(1, (now - t0) / 450); const e = from + (target - from) * a; group.userData.e = e; parts.forEach((p) => (p.mesh.position.y = p.dy * e)); render(); if (a < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    group.userData.e = explodeRef.current ? 1 : 0; parts.forEach((p) => (p.mesh.position.y = p.dy * group.userData.e));
    api.current = {
      rotate: (a) => { const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(off); controls.update(); render(); },
      zoom: (f) => { const off = camera.position.clone().sub(controls.target).multiplyScalar(f); camera.position.copy(controls.target).add(off); controls.update(); render(); },
      reset: () => { camera.position.copy(home); controls.target.set(0, 0, 0); controls.update(); render(); },
      explode: setExploded,
    };
    render();
    const onResize = () => { const W2 = el.clientWidth, H2 = Math.max(280, Math.round(W2 * 0.55)); renderer.setSize(W2, H2); camera.aspect = W2 / H2; camera.updateProjectionMatrix(); render(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); controls.dispose();
      parts.forEach((p) => p.mesh.geometry.dispose()); steel.dispose(); cs.dispose(); filler.dispose(); renderer.dispose(); renderer.domElement.remove(); api.current = null;
    };
  }, [noGl, cut, d.d1, d.d2, d.d3, d.d4, ir, cr, k, od, reduced]);

  React.useEffect(() => { explodeRef.current = explode; api.current?.explode(explode); }, [explode]);
  if (noGl) return <p className="rounded-md bg-muted p-4 text-sm">{t.noGl}</p>;
  const b = "inline-flex size-11 items-center justify-center rounded-md border border-steel-300 bg-white hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const tg = (on: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-ink bg-ink text-white" : "border-steel-300 bg-white"}`;
  return (
    <div data-gasket-3d>
      <div ref={host} role="img" aria-label={t.aria} className="w-full touch-none overflow-hidden rounded-lg border bg-gradient-to-b from-white to-steel-50" />
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="3D controls">
        <button type="button" className={b} aria-label={t.left} title={t.left} onClick={() => api.current?.rotate(-Math.PI / 8)}><RotateCcw className="size-4" /></button>
        <button type="button" className={b} aria-label={t.right} title={t.right} onClick={() => api.current?.rotate(Math.PI / 8)}><RotateCw className="size-4" /></button>
        <button type="button" className={b} aria-label={t.zin} title={t.zin} onClick={() => api.current?.zoom(0.8)}><ZoomIn className="size-4" /></button>
        <button type="button" className={b} aria-label={t.zout} title={t.zout} onClick={() => api.current?.zoom(1.25)}><ZoomOut className="size-4" /></button>
        <button type="button" className={b} aria-label={t.reset} title={t.reset} onClick={() => api.current?.reset()}><Home className="size-4" /></button>
        <button type="button" className={tg(cut)} aria-pressed={cut} onClick={() => setCut((c) => !c)}><Scissors className="size-4" aria-hidden="true" />{t.cut}</button>
        <button type="button" className={tg(explode)} aria-pressed={explode} onClick={() => setExplode((e) => !e)}><Expand className="size-4" aria-hidden="true" />{t.explode}</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.note(k, real)}</p>
    </div>
  );
}
