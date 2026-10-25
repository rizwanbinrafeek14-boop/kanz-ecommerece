"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, Panel } from "../ui";
import { ExtractedProductSchema, type ExtractedProduct } from "@/lib/catalogue/schema";
import { validateExtracted } from "@/lib/catalogue/validate";
import { setExtractedStatus, updateExtracted } from "@/lib/admin/catalogue-actions";
import { run } from "@/lib/admin/client";
import { cn } from "@/lib/utils";

type P = ExtractedProduct;
const cell = "h-8 w-full min-w-16 rounded border border-input bg-background px-1.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Side-by-side review: the source page on the left, every extracted value editable on the right, live validation. */
export function ItemEditor({ id, status, initial, duplicate, pages, categories }: { id: string; sourceId?: string; status: string; initial: P; duplicate: { kind?: string; message?: string } | null; pages: { page: number; url: string | null }[]; categories: { slug: string; name: string; child: boolean }[] }) {
  const router = useRouter();
  const [p, setP] = React.useState<P>(initial); const [busy, setBusy] = React.useState(false); const [dirty, setDirty] = React.useState(false);
  const [view, setView] = React.useState(initial.pages[0] ?? 1); const [json, setJson] = React.useState("");
  const [crop, setCrop] = React.useState<null | { kind: "photo" | "drawing" | "table"; table?: number }>(null);
  const issues = React.useMemo(() => validateExtracted(p), [p]);
  const errors = issues.filter((i) => i.severity === "error");
  const up = (fn: (d: P) => void) => { setP((cur) => { const n = structuredClone(cur); fn(n); return n; }); setDirty(true); };
  const locked = status === "imported";

  const save = async () => { setBusy(true); const r = await run(updateExtracted(id, p), (d) => `Saved: ${d.errors} errors, ${d.warnings} warnings`); setBusy(false); if (r) { setDirty(false); router.refresh(); } };
  const approve = async () => { if (dirty) { toast.error("Save your changes first."); return; } if (await run(setExtractedStatus([id], "approved"), (d) => (d.blocked ? "Blocked: fix the errors first" : "Approved"))) router.refresh(); };
  const pageUrl = pages.find((x) => x.page === view)?.url;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Source page with image areas */}
      <div className="xl:sticky xl:top-4 xl:self-start">
        <Panel title="Source page" actions={<NativeSelect value={view} onChange={(e) => setView(Number(e.target.value))} className="h-8 w-32 text-xs" aria-label="Page">{pages.map((x) => <option key={x.page} value={x.page}>Page {x.page}{p.pages.includes(x.page) ? " •" : ""}</option>)}</NativeSelect>}>
          {pageUrl ? <PageCanvas url={pageUrl} boxes={[...p.images.map((im, i) => ({ page: im.page, bbox: im.bbox, label: `${im.kind} ${i + 1}`, tone: "red" })), ...p.dimension_tables.flatMap((t, i) => (t.drawing ? [{ page: t.drawing.page, bbox: t.drawing.bbox, label: `drawing T${i + 1}`, tone: "blue" }] : []))].filter((b) => b.page === view)}
            cropping={!!crop && !locked} onCrop={(bbox) => { if (!crop) return; up((d) => { if (crop.kind === "table" && crop.table != null) d.dimension_tables[crop.table].drawing = { page: view, bbox }; else d.images.push({ page: view, bbox, kind: crop.kind as "photo" | "drawing", alt_en: `${d.name_en}${crop.kind === "drawing" ? " — dimensional drawing" : ""}`, alt_ar: null }); }); setCrop(null); }} />
            : <p className="py-10 text-center text-sm text-muted-foreground">Page not rendered.</p>}
          {crop && <p className="mt-2 rounded bg-sky-50 p-2 text-xs text-sky-900">Drag a rectangle on the page to select the {crop.kind === "table" ? "table drawing" : crop.kind}. <button className="underline" onClick={() => setCrop(null)}>Cancel</button></p>}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Checks" actions={<div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || !dirty || locked} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
          <Button size="sm" disabled={busy || errors.length > 0 || locked || status === "approved"} onClick={approve}>{status === "approved" ? "Approved" : "Approve"}</Button>
        </div>}>
          {locked && <p className="mb-2 text-sm text-muted-foreground">Already imported. Edit the product itself from now on.</p>}
          {duplicate?.message && <p className={cn("mb-2 rounded p-2 text-sm", duplicate.kind === "duplicate" ? "bg-sky-50 text-sky-900" : "bg-muted")}>{duplicate.message}</p>}
          {!issues.length ? <p className="text-sm text-emerald-700">No issues found.</p> : (
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">{issues.map((i, n) => <li key={n} className="flex gap-2"><Badge variant={i.severity === "error" ? "destructive" : i.severity === "warning" ? "warning" : "secondary"}>{i.severity}</Badge><span>{i.message}{i.page ? <button className="ms-1 text-xs underline" onClick={() => setView(i.page!)}>p.{i.page}</button> : null}</span></li>)}</ul>)}
        </Panel>

        <Tabs defaultValue="general">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="variants">Options & variants ({p.variants.length})</TabsTrigger><TabsTrigger value="dims">Dimensions ({p.dimension_tables.length})</TabsTrigger><TabsTrigger value="specs">Standards & materials</TabsTrigger><TabsTrigger value="images">Images ({p.images.length})</TabsTrigger><TabsTrigger value="json" onClick={() => setJson(JSON.stringify(p, null, 2))}>JSON</TabsTrigger></TabsList>

          <TabsContent value="general"><Panel><fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name (English)"><Input value={p.name_en} onChange={(e) => up((d) => { d.name_en = e.target.value; })} /></Field>
            <Field label="Product name (Arabic)" hint="Draft translation: have it checked."><Input dir="rtl" value={p.name_ar ?? ""} onChange={(e) => up((d) => { d.name_ar = e.target.value || null; })} /></Field>
            <Field label="Family key" hint="Shared across manufacturers, e.g. forged-elbow-90"><Input className="font-mono" value={p.family.key} onChange={(e) => up((d) => { d.family.key = e.target.value.toLowerCase(); })} /></Field>
            <Field label="Family name"><Input value={p.family.name_en} onChange={(e) => up((d) => { d.family.name_en = e.target.value; })} /></Field>
            <Field label="Category"><NativeSelect value={p.category_slug ?? ""} onChange={(e) => up((d) => { d.category_slug = e.target.value || null; })}><option value="">Choose…</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.child ? "— " : ""}{c.name}</option>)}</NativeSelect></Field>
            <Field label="Manufacturer reference"><Input value={p.manufacturer_ref ?? ""} onChange={(e) => up((d) => { d.manufacturer_ref = e.target.value || null; })} /></Field>
            <Field label="Country of manufacture" hint="Only if the catalogue states it."><Input value={p.country ?? ""} onChange={(e) => up((d) => { d.country = e.target.value || null; })} /></Field>
            <Field label="Confidence (0–1)"><Input type="number" step="0.05" min={0} max={1} value={p.confidence} onChange={(e) => up((d) => { d.confidence = Number(e.target.value); })} /></Field>
            <Field label="Short description (English)" hint="Leave empty to generate it from the data." className="sm:col-span-2"><Textarea rows={2} value={p.short_en ?? ""} onChange={(e) => up((d) => { d.short_en = e.target.value || null; })} /></Field>
            <Field label="Applications (one per line, only as stated)" className="sm:col-span-2"><Textarea rows={3} value={p.applications_en.join("\n")} onChange={(e) => up((d) => { d.applications_en = lines(e.target.value); })} /></Field>
            <Field label="Notes / footnotes (one per line, verbatim)" className="sm:col-span-2"><Textarea rows={3} value={p.notes.join("\n")} onChange={(e) => up((d) => { d.notes = lines(e.target.value); })} /></Field>
          </fieldset></Panel></TabsContent>

          <TabsContent value="variants"><VariantsEditor p={p} up={up} locked={locked} /></TabsContent>
          <TabsContent value="dims"><DimsEditor p={p} up={up} locked={locked} onDrawing={(t) => setCrop({ kind: "table", table: t })} /></TabsContent>

          <TabsContent value="specs"><Panel><fieldset disabled={locked} className="space-y-6">
            <div><p className="mb-2 text-sm font-medium">Standards</p>
              {p.standards.map((s, i) => <div key={i} className="mb-2 grid grid-cols-[1fr_9rem_5rem_auto] gap-2"><input className={cell} value={s.code} onChange={(e) => up((d) => { d.standards[i].code = e.target.value; })} aria-label="Standard" /><select className={cell} value={s.scope} onChange={(e) => up((d) => { d.standards[i].scope = e.target.value as "product" | "general"; })} aria-label="Scope"><option value="product">this product</option><option value="general">general mention</option></select><input className={cell} type="number" value={s.page ?? ""} onChange={(e) => up((d) => { d.standards[i].page = Number(e.target.value) || undefined; })} aria-label="Page" /><Button size="icon" variant="ghost" aria-label="Remove standard" onClick={() => up((d) => { d.standards.splice(i, 1); })}><Trash2 className="size-4" /></Button></div>)}
              <Button size="sm" variant="outline" onClick={() => up((d) => { d.standards.push({ code: "", scope: "product", page: view }); })}><Plus className="size-4" />Standard</Button></div>
            <div><p className="mb-2 text-sm font-medium">Materials & grades (only grades the catalogue lists for this product)</p>
              {p.materials.map((m, i) => <div key={i} className="mb-2 grid grid-cols-[12rem_1fr_5rem_auto] gap-2"><input className={cell} value={m.type} onChange={(e) => up((d) => { d.materials[i].type = e.target.value; })} aria-label="Material" /><input className={cell} value={m.grades.join(", ")} onChange={(e) => up((d) => { d.materials[i].grades = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); })} aria-label="Grades" placeholder="ASTM A105, …" /><input className={cell} type="number" value={m.page ?? ""} onChange={(e) => up((d) => { d.materials[i].page = Number(e.target.value) || undefined; })} aria-label="Page" /><Button size="icon" variant="ghost" aria-label="Remove material" onClick={() => up((d) => { d.materials.splice(i, 1); })}><Trash2 className="size-4" /></Button></div>)}
              <Button size="sm" variant="outline" onClick={() => up((d) => { d.materials.push({ type: "", grades: [], page: view }); })}><Plus className="size-4" />Material</Button></div>
          </fieldset></Panel></TabsContent>

          <TabsContent value="images"><Panel>
            <div className="mb-3 flex gap-2"><Button size="sm" variant="outline" disabled={locked} onClick={() => setCrop({ kind: "photo" })}><Crop className="size-4" />Select product photo</Button><Button size="sm" variant="outline" disabled={locked} onClick={() => setCrop({ kind: "drawing" })}><Crop className="size-4" />Select drawing</Button></div>
            <p className="mb-3 text-xs text-muted-foreground">Images are cropped from the rendered page when you import. Include only one product per photo; drawings keep their original labels and markings.</p>
            <ul className="space-y-2">{p.images.map((im, i) => <li key={i} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2"><span className="text-xs">{im.kind} · p.{im.page}</span><input className={cell} value={im.alt_en} onChange={(e) => up((d) => { d.images[i].alt_en = e.target.value; })} aria-label="Alt text" /><Button size="icon" variant="ghost" aria-label="Remove image" disabled={locked} onClick={() => up((d) => { d.images.splice(i, 1); })}><Trash2 className="size-4" /></Button></li>)}</ul>
          </Panel></TabsContent>

          <TabsContent value="json"><Panel>
            <Textarea rows={24} className="font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} disabled={locked} />
            <Button size="sm" className="mt-2" disabled={locked} onClick={() => { try { const r = ExtractedProductSchema.safeParse(JSON.parse(json)); if (!r.success) throw new Error(r.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")); setP(r.data); setDirty(true); toast.success("Applied: remember to save"); } catch (e) { toast.error((e as Error).message); } }}>Apply JSON</Button>
          </Panel></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function VariantsEditor({ p, up, locked }: { p: P; up: (fn: (d: P) => void) => void; locked: boolean }) {
  return (<Panel><fieldset disabled={locked} className="space-y-6">
    <div>
      <p className="mb-2 text-sm font-medium">Options (what customers choose)</p>
      {p.options.map((o, oi) => (
        <div key={oi} className="mb-3 rounded-md border p-3">
          <div className="mb-2 grid grid-cols-[9rem_1fr_auto] gap-2"><input className={cell} value={o.key} onChange={(e) => up((d) => { const old = d.options[oi].key; const k = e.target.value.toLowerCase(); d.options[oi].key = k; d.variants.forEach((v) => { if (old in v.options) { v.options[k] = v.options[old]; delete v.options[old]; } }); })} aria-label="Option key" /><input className={cell} value={o.name_en} onChange={(e) => up((d) => { d.options[oi].name_en = e.target.value; })} aria-label="Option name" /><Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => up((d) => { const k = d.options[oi].key; d.options.splice(oi, 1); d.variants.forEach((v) => delete v.options[k]); })}><Trash2 className="size-4" /></Button></div>
          <div className="flex flex-wrap gap-1.5">{o.values.map((v, vi) => <span key={vi} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs"><input className="w-20 bg-transparent font-mono" value={v.value} onChange={(e) => up((d) => { d.options[oi].values[vi].value = e.target.value; })} aria-label="Value" /><input className="w-24 bg-transparent" value={v.label_en} onChange={(e) => up((d) => { d.options[oi].values[vi].label_en = e.target.value; })} aria-label="Label" /><button type="button" aria-label="Remove value" onClick={() => up((d) => { d.options[oi].values.splice(vi, 1); })}>×</button></span>)}
            <button type="button" className="text-xs text-primary underline" onClick={() => up((d) => { d.options[oi].values.push({ value: "new", label_en: "New" }); })}>+ value</button></div>
        </div>))}
      <Button size="sm" variant="outline" onClick={() => up((d) => { d.options.push({ key: `option_${d.options.length + 1}`, name_en: "New option", values: [{ value: "x", label_en: "x" }] }); })}><Plus className="size-4" />Option</Button>
    </div>
    <div>
      <p className="mb-1 text-sm font-medium">Valid combinations (variants)</p>
      <p className="mb-2 text-xs text-muted-foreground">Only combinations the catalogue lists. There is deliberately no “generate all combinations” button.</p>
      <div className="max-h-[32rem] overflow-auto"><table className="text-xs"><thead className="sticky top-0 bg-card"><tr>{p.options.map((o) => <th key={o.key} className="p-1 text-start">{o.name_en}</th>)}<th className="p-1 text-start">Mfr code</th><th className="p-1 text-start">Weight kg</th><th className="p-1 text-start">Page</th><th /></tr></thead>
        <tbody>{p.variants.map((v, vi) => <tr key={vi}>
          {p.options.map((o) => <td key={o.key} className="p-0.5"><select className={cell} value={v.options[o.key] ?? ""} onChange={(e) => up((d) => { d.variants[vi].options[o.key] = e.target.value; })} aria-label={o.name_en}><option value="">—</option>{o.values.map((x) => <option key={x.value} value={x.value}>{x.label_en}</option>)}</select></td>)}
          <td className="p-0.5"><input className={cell} value={v.manufacturer_code ?? ""} onChange={(e) => up((d) => { d.variants[vi].manufacturer_code = e.target.value || null; })} aria-label="Manufacturer code" /></td>
          <td className="p-0.5"><input className={cell} type="number" step="any" value={v.weight_kg ?? ""} onChange={(e) => up((d) => { d.variants[vi].weight_kg = e.target.value === "" ? null : Number(e.target.value); })} aria-label="Weight" /></td>
          <td className="p-0.5"><input className={cell} type="number" value={v.page ?? ""} onChange={(e) => up((d) => { d.variants[vi].page = Number(e.target.value) || undefined; })} aria-label="Page" /></td>
          <td><button type="button" aria-label="Remove variant" className="p-1 text-destructive" onClick={() => up((d) => { d.variants.splice(vi, 1); })}>×</button></td>
        </tr>)}</tbody></table></div>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => up((d) => { const last = d.variants.at(-1); d.variants.push({ options: { ...(last?.options ?? {}) }, page: last?.page }); })}><Plus className="size-4" />Variant</Button>
    </div>
  </fieldset></Panel>);
}

function DimsEditor({ p, up, locked, onDrawing }: { p: P; up: (fn: (d: P) => void) => void; locked: boolean; onDrawing: (t: number) => void }) {
  return (<div className="space-y-4">{p.dimension_tables.map((t, ti) => (
    <Panel key={ti} title={`T${ti + 1} · ${t.title_en}`} actions={<div className="flex gap-1"><Button size="sm" variant="outline" disabled={locked} onClick={() => onDrawing(ti)}><Crop className="size-4" />{t.drawing ? "Re-select drawing" : "Select drawing"}</Button><Button size="icon" variant="ghost" aria-label="Remove table" disabled={locked} onClick={() => { if (confirm("Remove this table?")) up((d) => { d.dimension_tables.splice(ti, 1); }); }}><Trash2 className="size-4" /></Button></div>}>
      <fieldset disabled={locked} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_5rem]"><input className={cell} value={t.title_en} onChange={(e) => up((d) => { d.dimension_tables[ti].title_en = e.target.value; })} aria-label="Table title" /><input className={cell} value={Object.entries(t.applies).map(([k, v]) => `${k}=${v}`).join(", ")} onChange={(e) => up((d) => { d.dimension_tables[ti].applies = Object.fromEntries(e.target.value.split(",").map((x) => x.split("=").map((y) => y.trim())).filter((x) => x.length === 2 && x[0] && x[1])); })} aria-label="Applies to" placeholder="connection=socket_weld" /><input className={cell} type="number" value={t.page} onChange={(e) => up((d) => { d.dimension_tables[ti].page = Number(e.target.value) || 1; })} aria-label="Page" /></div>
        <div className="overflow-x-auto"><table className="text-xs"><thead><tr>
          {Object.keys(t.rows[0]?.match ?? {}).map((k) => <th key={k} className="p-1 text-start text-muted-foreground">{k}</th>)}
          {t.columns.map((c, ci) => <th key={ci} className="p-0.5"><input className={cell} value={c.key} onChange={(e) => up((d) => { const old = d.dimension_tables[ti].columns[ci].key; d.dimension_tables[ti].columns[ci].key = e.target.value; d.dimension_tables[ti].rows.forEach((r) => { if (old in r.values) { r.values[e.target.value] = r.values[old]; delete r.values[old]; } }); })} aria-label="Column key" title={`${c.label_en}${c.unit ? ` (${c.unit})` : ""}`} /><input className={cn(cell, "mt-0.5 font-sans")} value={c.unit ?? ""} onChange={(e) => up((d) => { d.dimension_tables[ti].columns[ci].unit = e.target.value || null; })} aria-label="Unit" placeholder="unit" /></th>)}
        </tr></thead>
          <tbody>{t.rows.map((r, ri) => <tr key={ri}>
            {Object.keys(t.rows[0]?.match ?? {}).map((k) => <td key={k} className="p-0.5"><input className={cell} value={r.match[k] ?? ""} onChange={(e) => up((d) => { d.dimension_tables[ti].rows[ri].match[k] = e.target.value; })} aria-label={k} /></td>)}
            {t.columns.map((c) => <td key={c.key} className="p-0.5"><input className={cell} value={r.values[c.key] ?? ""} onChange={(e) => up((d) => { const v = e.target.value; if (v === "") delete d.dimension_tables[ti].rows[ri].values[c.key]; else d.dimension_tables[ti].rows[ri].values[c.key] = v; })} aria-label={`${c.key} for row ${ri + 1}`} /></td>)}
            <td><button type="button" aria-label="Remove row" className="p-1 text-destructive" onClick={() => up((d) => { d.dimension_tables[ti].rows.splice(ri, 1); })}>×</button></td>
          </tr>)}</tbody></table></div>
        <Button size="sm" variant="outline" onClick={() => up((d) => { const last = d.dimension_tables[ti].rows.at(-1); d.dimension_tables[ti].rows.push({ match: { ...(last?.match ?? {}) }, values: {} }); })}><Plus className="size-4" />Row</Button>
        <Field label="Footnotes (one per line, verbatim)"><Textarea rows={2} value={t.notes.join("\n")} onChange={(e) => up((d) => { d.dimension_tables[ti].notes = lines(e.target.value); })} /></Field>
      </fieldset>
    </Panel>))}
    {!p.dimension_tables.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No dimension table was extracted for this product.</p>}
  </div>);
}

/** Shows a page image with existing boxes and lets the reviewer drag a new rectangle (fractions of the page). */
function PageCanvas({ url, boxes, cropping, onCrop }: { url: string; boxes: { bbox: [number, number, number, number]; label: string; tone: string }[]; cropping: boolean; onCrop: (bbox: [number, number, number, number]) => void }) {
  const ref = React.useRef<HTMLDivElement>(null); const [drag, setDrag] = React.useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  return (
    <div ref={ref} className={cn("relative select-none overflow-hidden rounded border bg-white", cropping && "cursor-crosshair")}
      onPointerDown={(e) => { if (!cropping) return; const q = pos(e); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag({ x0: q.x, y0: q.y, x1: q.x, y1: q.y }); }}
      onPointerMove={(e) => { if (drag) { const q = pos(e); setDrag({ ...drag, x1: q.x, y1: q.y }); } }}
      onPointerUp={() => { if (drag) { const b: [number, number, number, number] = [Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1)]; setDrag(null); if (b[2] - b[0] > 0.02 && b[3] - b[1] > 0.02) onCrop(b.map((x) => Number(x.toFixed(4))) as [number, number, number, number]); } }}>
      <img src={url} alt="Source catalogue page" className="pointer-events-none block w-full" draggable={false} />
      {boxes.map((b, i) => <span key={i} className={cn("pointer-events-none absolute border-2", b.tone === "blue" ? "border-sky-500" : "border-red-500")} style={{ left: `${b.bbox[0] * 100}%`, top: `${b.bbox[1] * 100}%`, width: `${(b.bbox[2] - b.bbox[0]) * 100}%`, height: `${(b.bbox[3] - b.bbox[1]) * 100}%` }}><span className={cn("absolute -top-4 start-0 px-1 text-[10px] text-white", b.tone === "blue" ? "bg-sky-500" : "bg-red-500")}>{b.label}</span></span>)}
      {drag && <span className="pointer-events-none absolute border-2 border-dashed border-sky-600 bg-sky-400/10" style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }} />}
    </div>
  );
}
