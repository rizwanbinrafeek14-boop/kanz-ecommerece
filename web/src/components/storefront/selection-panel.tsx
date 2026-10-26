"use client";
import * as React from "react";
import { useSelectedVariant } from "@/lib/variant-store";
import type { DimensionTableRow } from "@/lib/queries/catalog";

const fits = (want: Record<string, string>, have: Record<string, string>) => Object.entries(want).every(([k, v]) => have[k] === v);

/**
 * "Your selection": the exact configuration and its key dimensions, next to the drawing, so an engineer does not have to open the
 * dimension tab. Values come only from the table row that applies to the selected configuration.
 */
export function SelectionPanel({ tables, variants, lang, source }: { tables: DimensionTableRow[]; variants: { id: string; options?: Record<string, string>; label: string; sku: string }[]; lang: string; source: string }) {
  const ar = lang === "ar";
  const vid = useSelectedVariant(); const v = variants.find((x) => x.id === vid);
  const rows = v?.options ? tables.filter((t) => fits(t.applies, v.options!)).map((t) => ({ t, r: t.rows.find((r) => fits(r.match, v.options!)) })).filter((x) => x.r) : [];
  return (
    <section aria-labelledby="sel-h" className="rounded-xl border bg-card p-4" data-selection-panel aria-live="polite">
      <h2 id="sel-h" className="spec-label text-steel-600">{ar ? "اختيارك" : "Your selection"}</h2>
      {!v ? <p className="mt-2 text-sm text-muted-foreground">{ar ? "اختر التكوين لعرض أبعاده." : "Choose a configuration to see its dimensions."}</p> : <>
        <p className="mt-1 font-semibold">{v.label}</p>
        <p className="font-mono text-xs text-muted-foreground" dir="ltr">{v.sku}</p>
        {rows.length ? rows.map(({ t, r }) => (
          <div key={t.id} className="mt-3">
            <p className="text-xs text-muted-foreground">{(ar && t.title_ar) || t.title_en}</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {t.columns.filter((c) => r!.values[c.key] != null && r!.values[c.key] !== "").map((c) => (
                <div key={c.key}><dt className="text-[11px] leading-tight text-steel-600">{(ar && c.label_ar) || c.label_en}{c.symbol ? <span className="font-mono"> ({c.symbol})</span> : null}</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums" dir="ltr">{r!.values[c.key]}{c.unit ? <span className="ms-1 text-xs font-normal text-steel-500">{c.unit}</span> : null}</dd></div>))}
            </dl>
          </div>)) : <p className="mt-2 text-sm text-muted-foreground">{ar ? "لا توجد أبعاد منشورة لهذا الاختيار (يُصنع حسب الوصلة أو الرسم)." : "No dimensions are published for this selection (made to the joint or drawing)."}</p>}
        <p className="mt-3 text-[11px] text-steel-500">{source}</p>
      </>}
    </section>);
}
