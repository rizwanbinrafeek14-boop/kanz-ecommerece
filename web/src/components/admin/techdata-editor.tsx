"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Panel } from "./ui";
import { run } from "@/lib/admin/client";
import { saveDimensionTable, saveTechSpecs } from "@/lib/admin/techdata-actions";
import type { ConfigChoice } from "@/lib/types";

export interface TechTable { id: string; title_en: string; title_ar: string | null; notes: string[]; applies: Record<string, string>; columns: { key: string; symbol?: string | null; label_en: string; unit?: string | null }[]; rows: { match: Record<string, string>; values: Record<string, string> }[] }
export interface TechSpecs { choices: ConfigChoice[]; properties: { label_en: string; label_ar?: string | null; value_en: string; value_ar?: string | null }[]; notes: string[]; standards: { code: string; note?: string | null }[] }

const kv = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join("; ");
const parseKv = (t: string) => Object.fromEntries(t.split(/[;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf("="); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }).filter(([k, v]) => k && v));

/** Import review notes (missing / ambiguous data, possible duplicate products) written by a catalogue import. */
export function ImportReview({ review, matches, supplierNote }: { review: string[]; matches: string | null; supplierNote?: string | null }) {
  if (!review.length && !matches) return null;
  return (
    <div className="rounded-xl border-2 border-warning/40 bg-warning/5 p-4" data-import-review>
      <p className="font-semibold">Check before publishing (from the catalogue import)</p>
      {matches && <p className="mt-2 text-sm"><strong>Possible existing match:</strong> {matches}. Nothing was overwritten — merge, link or unpublish one of them.</p>}
      {review.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">{review.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      {supplierNote && <p className="mt-2 text-xs text-muted-foreground">{supplierNote}</p>}
    </div>);
}

/** Technical data: configuration choices, specification rows, standards, notes and the dimension tables. */
export function TechDataEditor({ productId, specs, tables }: { productId: string; specs: TechSpecs; tables: TechTable[] }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false);
  const [choices, setChoices] = React.useState(JSON.stringify(specs.choices, null, 1));
  const [props, setProps] = React.useState(specs.properties.map((p) => `${p.label_en} | ${p.value_en}${p.label_ar || p.value_ar ? ` | ${p.label_ar ?? ""} | ${p.value_ar ?? ""}` : ""}`).join("\n"));
  const [stds, setStds] = React.useState(specs.standards.map((s) => `${s.code}${s.note ? ` | ${s.note}` : ""}`).join("\n"));
  const [notes, setNotes] = React.useState(specs.notes.join("\n"));
  const saveSpecs = async () => {
    let parsed: unknown; try { parsed = JSON.parse(choices || "[]"); } catch { alert("Configuration choices: not valid JSON."); return; }
    const properties = props.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((c) => c[0] && c[1]).map(([label_en, value_en, label_ar, value_ar]) => ({ label_en, value_en, label_ar: label_ar || null, value_ar: value_ar || null }));
    const standards = stds.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((c) => c[0]).map(([code, note]) => ({ code, note: note || null }));
    setBusy(true); const r = await run(saveTechSpecs(productId, { choices: parsed, properties, standards, notes: notes.split("\n") }), "Technical data saved"); setBusy(false); if (r) router.refresh();
  };
  return (
    <div className="space-y-4">
      <Panel title="Configuration choices, specifications and standards">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-1.5 lg:row-span-3"><span className="text-sm font-medium">Configuration choices (JSON)</span>
            <span className="block text-xs text-muted-foreground">Asked on the product page and written into the enquiry, e.g. winding metal, filler, sheet material, thickness. <code>requires</code> limits a choice or a value to options (e.g. <code>{`{"style":["SW-IR/CR"]}`}</code>); <code>material</code> links a value to a material code.</span>
            <Textarea rows={22} value={choices} onChange={(e) => setChoices(e.target.value)} className="font-mono text-xs" spellCheck={false} aria-label="Configuration choices JSON" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Specification rows</span><span className="block text-xs text-muted-foreground">One per line: label | value (| Arabic label | Arabic value)</span>
            <Textarea rows={6} value={props} onChange={(e) => setProps(e.target.value)} className="font-mono text-xs" aria-label="Specification rows" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Standards</span><span className="block text-xs text-muted-foreground">One per line: code | note. Information only — not a certification.</span>
            <Textarea rows={5} value={stds} onChange={(e) => setStds(e.target.value)} className="font-mono text-xs" aria-label="Standards" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Catalogue notes</span>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" aria-label="Catalogue notes" /></label>
        </div>
        <Button className="mt-4" disabled={busy} onClick={saveSpecs}>Save technical data</Button>
      </Panel>
      {tables.map((t) => <TableEditor key={t.id} productId={productId} t={t} />)}
      {!tables.length && <p className="text-sm text-muted-foreground">This product has no dimension tables.</p>}
    </div>);
}

function TableEditor({ productId, t }: { productId: string; t: TechTable }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false);
  const matchKeys = [...new Set(t.rows.flatMap((r) => Object.keys(r.match)))];
  const initial = [[...matchKeys, ...t.columns.map((c) => c.key)].join("\t"), ...t.rows.map((r) => [...matchKeys.map((k) => r.match[k] ?? ""), ...t.columns.map((c) => r.values[c.key] ?? "")].join("\t"))].join("\n");
  const [f, setF] = React.useState({ title_en: t.title_en, title_ar: t.title_ar ?? "", notes: t.notes.join("\n"), applies: kv(t.applies), text: initial });
  return (
    <Panel title={t.title_en}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">Title (English)<Input value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></label>
        <label className="space-y-1 text-sm">Title (Arabic)<Input dir="rtl" value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></label>
        <label className="space-y-1 text-sm md:col-span-2">Applies to (options, e.g. <code>standard=ASME B16.5</code>) — the table is shown only for these selections<Input value={f.applies} onChange={(e) => setF({ ...f, applies: e.target.value })} /></label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Rows (tab or ; separated). Columns: {t.columns.map((c) => `${c.key} = ${c.label_en}${c.unit ? ` (${c.unit})` : ""}`).join(" · ")}. Empty or – = not listed. Copy to / from a spreadsheet.</p>
      <Textarea rows={Math.min(18, t.rows.length + 2)} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} className="mt-1 font-mono text-xs" spellCheck={false} aria-label={`Rows of ${t.title_en}`} />
      <label className="mt-3 block space-y-1 text-sm">Notes (one per line)<Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="text-xs" /></label>
      <Button className="mt-3" size="sm" disabled={busy} onClick={async () => {
        setBusy(true); const r = await run(saveDimensionTable(productId, t.id, { title_en: f.title_en, title_ar: f.title_ar || null, notes: f.notes.split("\n"), applies: parseKv(f.applies), matchKeys, text: f.text }), (d) => `Saved (${d.rows} rows)`); setBusy(false); if (r) router.refresh();
      }}>Save table</Button>
    </Panel>);
}
