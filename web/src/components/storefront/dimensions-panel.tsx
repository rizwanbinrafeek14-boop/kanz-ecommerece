"use client";
import * as React from "react";
import { useSelectedVariant } from "@/lib/variant-store";
import type { DimensionTableRow } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils";

const fits = (want: Record<string, string>, have: Record<string, string>) => Object.entries(want).every(([k, v]) => have[k] === v);

/**
 * Dimension tables for the selected variant: only tables that apply to it are shown, and the exact row is highlighted and summarised.
 * Before a selection exists (e.g. for crawlers) every table is shown in full.
 */
export function DimensionsPanel({ tables, variants, optionLabels, labels, drawings }: {
  tables: DimensionTableRow[]; variants: { id: string; options: Record<string, string>; label: string }[]; optionLabels: Record<string, Record<string, string>>; drawings: Record<string, string | null>;
  labels: { selected: string; none: string; showAll: string; showFewer: string; source: string; drawing: string; asPublished: string };
}) {
  const vid = useSelectedVariant(); const v = variants.find((x) => x.id === vid);
  const [all, setAll] = React.useState<Record<string, boolean>>({});
  const visible = v ? tables.filter((t) => fits(t.applies, v.options)) : tables;
  if (!visible.length) return <p className="text-sm text-muted-foreground">{labels.none}</p>;
  return (
    <div className="space-y-10">
      {visible.map((t) => {
        const rowKeys = [...new Set(t.rows.flatMap((r) => Object.keys(r.match)))];
        const hit = v ? t.rows.find((r) => fits(r.match, v.options)) : undefined;
        const rows = v && hit && !all[t.id] ? [hit] : t.rows;
        return (
          <section key={t.id} aria-labelledby={`dt-${t.id}`}>
            <h3 id={`dt-${t.id}`} className="mb-3 font-semibold">{t.title_en}</h3>
            {drawings[t.id] && <figure className="mb-4 max-w-xl border border-steel-200 bg-white p-3"><img src={drawings[t.id]!} alt={`${labels.drawing}: ${t.title_en}`} loading="lazy" className="mx-auto max-h-80 w-auto object-contain" /><figcaption className="mt-2 text-xs text-muted-foreground">{labels.asPublished}</figcaption></figure>}
            {v && hit && (
              <div className="mb-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <p className="spec-label mb-2 text-steel-600">{labels.selected}: {v.label}</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  {t.columns.filter((c) => hit.values[c.key] !== undefined).map((c) => <div key={c.key}><dt className="text-xs text-steel-600">{c.label_en}{c.symbol ? ` (${c.symbol})` : ""}</dt><dd className="font-mono text-lg tabular-nums">{hit.values[c.key]}{c.unit ? <span className="ms-1 text-xs text-steel-500">{c.unit}</span> : null}</dd></div>)}
                </dl>
              </div>)}
            <div className="overflow-x-auto rounded-md border border-steel-200">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-steel-50 text-xs text-steel-700"><tr>
                  {rowKeys.map((k) => <th key={k} scope="col" className="p-2 text-start font-semibold capitalize">{k.replace(/_/g, " ")}</th>)}
                  {t.columns.map((c) => <th key={c.key} scope="col" className="p-2 text-end font-semibold"><abbr title={c.label_en} className="no-underline">{c.symbol ?? c.key}</abbr>{c.unit ? <span className="block font-normal text-steel-500">{c.unit}</span> : null}</th>)}
                </tr></thead>
                <tbody>{rows.map((r, i) => {
                  const on = hit === r;
                  return <tr key={i} aria-current={on ? "true" : undefined} className={cn("border-t border-steel-100", on && "bg-primary/10 font-semibold")}>
                    {rowKeys.map((k) => <th key={k} scope="row" className="p-2 text-start font-mono font-normal">{optionLabels[k]?.[r.match[k]] ?? r.match[k] ?? "—"}</th>)}
                    {t.columns.map((c) => <td key={c.key} className="p-2 text-end font-mono tabular-nums">{r.values[c.key] ?? "—"}</td>)}
                  </tr>; })}</tbody>
              </table>
            </div>
            {v && hit && t.rows.length > 1 && <button type="button" className="mt-2 min-h-10 text-sm font-medium text-primary hover:underline" onClick={() => setAll((s) => ({ ...s, [t.id]: !s[t.id] }))}>{all[t.id] ? labels.showFewer : labels.showAll.replace("{n}", String(t.rows.length))}</button>}
            {t.notes.length > 0 && <ol className="mt-3 list-decimal space-y-1 ps-5 text-xs text-steel-600">{t.notes.map((n, i) => <li key={i}>{n}</li>)}</ol>}
            <p className="mt-2 text-xs text-steel-500">{labels.source}{t.source_page ? ` p.${t.source_page}` : ""}</p>
          </section>);
      })}
    </div>
  );
}
