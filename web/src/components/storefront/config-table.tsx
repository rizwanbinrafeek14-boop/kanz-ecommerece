"use client";
import * as React from "react";
import { useProductData } from "@/lib/product-data";

/**
 * "Configurations (n)" list on the product page, built in the browser from the variant list the page already sends (no second copy
 * in the HTML). Closed, it holds the first rows; opening it shows every configuration.
 */
export function ConfigTable({ title, options, optionLabels, labels, showCodes, showWeights }: {
  title: string; options: { key: string; name: string }[]; optionLabels: Record<string, Record<string, string>>;
  labels: { sku: string; code: string; weight: string }; showCodes: boolean; showWeights: boolean;
}) {
  const variants = useProductData()?.variants ?? []; const [open, setOpen] = React.useState(false);
  const rows = open ? variants : variants.slice(0, 10);
  return (
    <details className="rounded-md border border-steel-200" data-all-configs onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer p-3 text-sm font-semibold">{title} ({variants.length})</summary>
      <div className="overflow-x-auto rounded-md border border-steel-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label={title}><table className="w-full text-sm">
        <thead className="bg-steel-50 text-xs text-steel-700"><tr><th scope="col" className="p-2.5 text-start">{labels.sku}</th>{options.map((o) => <th key={o.key} scope="col" className="p-2.5 text-start">{o.name}</th>)}{showCodes && <th scope="col" className="p-2.5 text-start">{labels.code}</th>}{showWeights && <th scope="col" className="p-2.5 text-end">{labels.weight}</th>}</tr></thead>
        <tbody>{rows.map((v) => <tr key={v.id} className="border-t border-steel-100"><td className="p-2.5 font-mono" dir="ltr">{v.sku}</td>{options.map((o) => <td key={o.key} className="p-2.5 font-mono">{optionLabels[o.key]?.[v.options?.[o.key] ?? ""] ?? "—"}</td>)}{showCodes && <td className="p-2.5 font-mono" dir="ltr">{v.code ?? "—"}</td>}{showWeights && <td className="p-2.5 text-end font-mono tabular-nums">{v.weight != null ? v.weight.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}</td>}</tr>)}</tbody>
      </table></div>
    </details>);
}
