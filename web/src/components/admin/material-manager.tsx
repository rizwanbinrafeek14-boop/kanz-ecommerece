"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { Panel, Empty } from "./ui";
import { run } from "@/lib/admin/client";
import { runMaterialDetection, setProductMaterial, removeProductMaterial, approveDetected, bulkSetMaterial, setVariantMaterial, saveMaterialType, deleteMaterialType } from "@/lib/admin/material-actions";
import type { MaterialReport, ReportRow } from "@/lib/materials/run";

export interface MaterialType { code: string; name_en: string; name_ar: string | null; sort_order: number; is_custom: boolean }
export interface MaterialRow { material_code: string; grades: string[]; status: "auto" | "unverified" | "verified" | "rejected"; source: string | null; note: string | null; edited_by_admin: boolean; components?: { role: string; grades?: string[]; note?: string }[]; origin?: string }
export const STATUS: Record<MaterialRow["status"], [label: string, variant: "success" | "info" | "warning" | "secondary"]> = {
  verified: ["Verified", "success"], auto: ["Auto-detected (shown)", "info"], unverified: ["Not verified (hidden)", "warning"], rejected: ["Rejected", "secondary"],
};

/** Detection: preview the classification report, then apply it. Verified / admin-edited rows are never changed. */
export function DetectionPanel() {
  const router = useRouter(); const [rep, setRep] = React.useState<MaterialReport | null>(null); const [busy, setBusy] = React.useState(false); const [applied, setApplied] = React.useState(false);
  const go = async (dry: boolean) => {
    setBusy(true); const r = await run(runMaterialDetection(dry), dry ? undefined : (d) => `${d.written} material records written, ${d.removed} outdated removed, ${d.keptByAdmin} admin decisions kept`); setBusy(false);
    if (r) { setRep(r as MaterialReport); setApplied(!dry); if (!dry) router.refresh(); }
  };
  const list = (title: string, rows: ReportRow[], tone: "ok" | "warn" = "warn") => (
    <details className="rounded-lg border p-3" open={tone === "warn" && rows.length > 0 && rows.length < 15}>
      <summary className="cursor-pointer text-sm font-semibold">{title} <Badge variant={tone === "ok" ? "success" : rows.length ? "warning" : "secondary"}>{rows.length}</Badge></summary>
      <ul className="mt-2 max-h-72 space-y-1 overflow-auto text-xs">{rows.map((r) => (
        <li key={r.id}><Link className="underline" href={`/admin/products/${r.id}`}>{r.name}</Link> <span className="text-muted-foreground">{r.brand} · {r.materials.map((m) => `${m.code}${m.status === "unverified" ? "?" : ""}`).join(" ") || "no material"}</span>
          {r.conflicts.map((c, i) => <p key={i} className="text-destructive">{c}</p>)}</li>))}</ul>
    </details>);
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="detection">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm"><strong>Automatic material detection.</strong> Reads each product&apos;s name, material / grade attributes, variant grades and the catalogue grade lists. ASTM grades and explicit material names are shown in the shop straight away; general catalogue lists and description keywords wait for your approval. Your verified or rejected entries are never changed.</p>
        <Button variant="outline" disabled={busy} onClick={() => go(true)}>Preview report</Button>
        <Button disabled={busy} onClick={() => go(false)}>Run detection</Button>
      </div>
      {rep && <div className="mt-4 space-y-2">
        <p className="text-sm">{applied ? "Applied." : "Preview (nothing changed yet)."} {rep.scanned} products scanned · {rep.written} records {applied ? "written" : "to write"} · {rep.removed} outdated {applied ? "removed" : "to remove"} · {rep.keptByAdmin} admin decisions kept · {rep.variantsSet} variant materials {applied ? "set" : "to set"}.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {list("Classified (material shown in the shop)", rep.classified, "ok")}
          {list("Multiple materials", rep.multiple, "ok")}
          {list("Needs verification (Material Not Verified / hidden materials)", rep.needsVerification)}
          {list("Missing grades", rep.missingGrades)}
          {list("Possibly incorrect (conflicting data)", rep.conflicts)}
        </div>
      </div>}
    </div>
  );
}

export interface WorkbenchRow { id: string; name: string; brand: string | null; status: string; materials: MaterialRow[] }

export function MaterialsWorkbench({ rows, types }: { rows: WorkbenchRow[]; types: MaterialType[] }) {
  const router = useRouter(); const [sel, setSel] = React.useState<Set<string>>(new Set()); const [code, setCode] = React.useState(""); const [grades, setGrades] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel];
  const act = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, msg: string | ((d: T) => string)) => { setBusy(true); const r = await run(p, msg); setBusy(false); if (r) { setSel(new Set()); router.refresh(); } };
  const name = (c: string) => types.find((t) => t.code === c)?.name_en ?? c;
  if (!rows.length) return <Empty>No products match this filter.</Empty>;
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all" />{sel.size} selected</label>
        <Button size="sm" variant="outline" disabled={busy || !sel.size} onClick={() => act(approveDetected(ids), (d) => `${d.n} detected material(s) approved`)}>Approve detected</Button>
        <span className="mx-2 h-6 w-px bg-border" />
        <NativeSelect aria-label="Material for selected" value={code} onChange={(e) => setCode(e.target.value)} className="h-9 w-48"><option value="">Set material…</option>{types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name_en}</option>)}</NativeSelect>
        <Input aria-label="Grades for selected" placeholder="Grades (optional), e.g. A105, A182 F316L" value={grades} onChange={(e) => setGrades(e.target.value)} className="h-9 w-72" />
        <Button size="sm" disabled={busy || !sel.size || !code} onClick={() => act(bulkSetMaterial(ids, code, grades), (d) => `${name(code)} set on ${d.n} product(s)`)}>Apply to selected</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="w-8 p-2" /><th className="p-2">Product</th><th className="p-2">Materials (status · grades · detected from)</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t align-top" data-material-row={r.id}>
              <td className="p-2"><Checkbox checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} /></td>
              <td className="p-2"><Link href={`/admin/products/${r.id}?tab=materials`} className="font-medium hover:underline">{r.name}</Link><p className="text-xs text-muted-foreground">{r.brand} · {r.status}</p></td>
              <td className="p-2">{r.materials.filter((m) => m.status !== "rejected").length ? <ul className="space-y-1">{r.materials.filter((m) => m.status !== "rejected").map((m) => (
                <li key={m.material_code} className="flex flex-wrap items-baseline gap-1.5"><Badge variant="outline">{m.material_code}</Badge><Badge variant={STATUS[m.status][1]}>{STATUS[m.status][0]}</Badge>
                  <span className="text-xs">{m.grades.length ? m.grades.slice(0, 6).join(", ") + (m.grades.length > 6 ? ` +${m.grades.length - 6}` : "") : <em className="text-muted-foreground">no grade</em>}</span>
                  <span className="text-[11px] text-muted-foreground">· {m.source}</span></li>))}</ul>
                : <Badge variant="warning">Material Not Verified</Badge>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Product editor tab: materials of this manufacturer offering + per-variant material. */
export function ProductMaterials({ productId, rows, types, variants }: { productId: string; rows: MaterialRow[]; types: MaterialType[]; variants: { id: string; label: string; material_code: string | null }[] }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false); const [add, setAdd] = React.useState(""); const [edit, setEdit] = React.useState<Record<string, string>>({});
  const act = async (p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, msg: string) => { setBusy(true); const r = await run(p, msg); setBusy(false); if (r) router.refresh(); };
  const shown = rows.filter((r) => r.status !== "rejected");
  return (
    <div className="space-y-4">
      <Panel title="Materials of this product">
        <p className="mb-3 text-sm text-muted-foreground">Verified and auto-detected materials are shown in the shop and used by the Material filter. Not-verified detections stay hidden until you approve them. Anything you save here is never changed by the automatic detection.</p>
        {!shown.length && <p className="mb-3"><Badge variant="warning">Material Not Verified</Badge> <span className="text-sm text-muted-foreground">No material is known for this product yet.</span></p>}
        <ul className="space-y-3">{shown.map((m) => {
          const g = edit[m.material_code] ?? m.grades.join(", ");
          return (
            <li key={m.material_code} className="rounded-lg border p-3" data-material={m.material_code}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{m.material_code} · {types.find((t) => t.code === m.material_code)?.name_en}</span><Badge variant={STATUS[m.status][1]}>{STATUS[m.status][0]}</Badge>
                {m.edited_by_admin && <Badge variant="outline">admin decision</Badge>}</div>
              <p className="mt-1 text-xs text-muted-foreground">{m.origin === "import" ? "From catalogue import" : "Detected from"}: {m.source ?? "-"}{m.note ? ` · ${m.note}` : ""}</p>
              {!!m.components?.length && <p className="mt-1 text-xs"><span className="font-medium">Used for:</span> {m.components.map((c) => `${c.role}${c.grades?.length ? ` (${c.grades.join(", ")})` : c.note ? ` (${c.note})` : ""}`).join("; ")}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input aria-label={`Grades for ${m.material_code}`} value={g} onChange={(e) => setEdit((x) => ({ ...x, [m.material_code]: e.target.value }))} placeholder="Exact grades, comma separated" className="h-9 min-w-72 flex-1" />
                <Button size="sm" disabled={busy} onClick={() => act(setProductMaterial(productId, { code: m.material_code, grades: g, status: "verified", note: m.note }), "Material verified")}>{m.status === "verified" ? "Save grades" : "Approve"}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(removeProductMaterial(productId, m.material_code), "Material removed")}>Reject / remove</Button>
              </div>
            </li>); })}</ul>
        {rows.some((r) => r.status === "rejected") && <p className="mt-3 text-xs text-muted-foreground">Rejected (kept so detection does not add them again): {rows.filter((r) => r.status === "rejected").map((r) => r.material_code).join(", ")}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <NativeSelect aria-label="Add material" value={add} onChange={(e) => setAdd(e.target.value)} className="h-9 w-64"><option value="">Add a material…</option>{types.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name_en}</option>)}</NativeSelect>
          <Button size="sm" disabled={busy || !add} onClick={() => { const c = add; setAdd(""); void act(setProductMaterial(productId, { code: c, grades: [], status: "verified" }), "Material added"); }}>Add as verified</Button>
        </div>
      </Panel>
      {variants.length > 0 && <Panel title={`Material per variant (${variants.length})`}>
        <p className="mb-3 text-sm text-muted-foreground">Only needed when this product&apos;s variants are made in different materials. A variant left on &quot;Same as product&quot; is offered in every shown material of the product.</p>
        <details><summary className="cursor-pointer text-sm">Show variants ({variants.filter((v) => v.material_code).length} with their own material)</summary>
          <ul className="mt-2 max-h-96 divide-y overflow-auto rounded border">{variants.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-2 py-1 text-xs"><span className="flex-1 font-mono">{v.label}</span>
              <NativeSelect aria-label={`Material of ${v.label}`} className="h-8 w-48" defaultValue={v.material_code ?? ""} disabled={busy} onChange={(e) => act(setVariantMaterial(productId, v.id, e.target.value || null), "Variant material saved")}>
                <option value="">Same as product</option>{types.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}</NativeSelect></li>))}</ul></details>
      </Panel>}
    </div>
  );
}

export function MaterialTypes({ types, isAdmin }: { types: MaterialType[]; isAdmin: boolean }) {
  const router = useRouter(); const [f, setF] = React.useState({ code: "", name_en: "", name_ar: "" }); const [busy, setBusy] = React.useState(false);
  const act = async (p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, msg: string) => { setBusy(true); const r = await run(p, msg); setBusy(false); if (r) { setF({ code: "", name_en: "", name_ar: "" }); router.refresh(); } };
  return (
    <Panel title="Material types">
      <ul className="flex flex-wrap gap-2">{types.map((t) => <li key={t.code} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><strong>{t.code}</strong> {t.name_en}{t.is_custom && isAdmin && <button className="ms-1 text-destructive" aria-label={`Delete ${t.code}`} onClick={() => act(deleteMaterialType(t.code), "Deleted")}>×</button>}</li>)}</ul>
      {isAdmin && <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input aria-label="New code" placeholder="Code, e.g. TI" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="h-9 w-28" />
        <Input aria-label="New name" placeholder="Name, e.g. Titanium" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} className="h-9 w-48" />
        <Input aria-label="Arabic name" dir="rtl" placeholder="الاسم" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} className="h-9 w-40" />
        <Button size="sm" disabled={busy || !f.code || !f.name_en} onClick={() => act(saveMaterialType({ ...f, sort_order: 500 }, true), "Material type added")}>Add custom material</Button>
      </div>}
    </Panel>
  );
}
