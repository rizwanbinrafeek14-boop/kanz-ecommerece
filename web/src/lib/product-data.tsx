"use client";
import * as React from "react";
import { useSelectedVariant } from "@/lib/variant-store";
import type { DimensionTableRow } from "@/lib/queries/catalog";

/**
 * Product page data shared by the gallery, "Your selection", the dimension tables, the gasket explorer and the configuration list,
 * so each variant is sent to the browser once. Large dimension tables arrive trimmed (the first rows plus the default
 * configuration's row, `rowCount` = full size); the rest is fetched once, when a selection or "Show all" needs it.
 */
export interface LightVariant { id: string; options?: Record<string, string>; sku: string; label: string; code?: string; weight?: number }
interface Ctx { variants: LightVariant[]; tables: DimensionTableRow[]; complete: boolean; loading: boolean; load: () => Promise<void> }
const C = React.createContext<Ctx | null>(null);
import { fitsOptions } from "@/lib/options-match";
export { fitsOptions };
export const isComplete = (ts: DimensionTableRow[]) => ts.every((t) => (t.rowCount ?? t.rows.length) <= t.rows.length);

export function ProductDataProvider({ slug, variants, tables: initial, children }: { slug: string; variants: LightVariant[]; tables: DimensionTableRow[]; children: React.ReactNode }) {
  const [tables, setTables] = React.useState(initial); const [loading, setLoading] = React.useState(false);
  const complete = isComplete(tables); const busy = React.useRef<Promise<void> | null>(null);
  const load = React.useCallback(() => {
    if (complete) return Promise.resolve();
    busy.current ??= (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/product/${encodeURIComponent(slug)}/dimensions`);
        if (r.ok) { const j = (await r.json()) as { tables: { id: string; rows: DimensionTableRow["rows"] }[] }; const by = new Map(j.tables.map((t) => [t.id, t.rows]));
          setTables((ts) => ts.map((t) => (by.has(t.id) ? { ...t, rows: by.get(t.id)!, rowCount: by.get(t.id)!.length } : t))); }
      } finally { setLoading(false); busy.current = null; }
    })();
    return busy.current;
  }, [slug, complete]);
  // a selection whose row is not among the rows sent with the page: fetch the full tables once
  const vid = useSelectedVariant(); const v = variants.find((x) => x.id === vid);
  React.useEffect(() => {
    if (complete || !v?.options) return;
    const missing = tables.some((t) => fitsOptions(t.applies, v.options!) && (t.rowCount ?? 0) > t.rows.length && !t.rows.some((r) => fitsOptions(r.match, v.options!)));
    if (missing) void load();
  }, [v, tables, complete, load]);
  const value = React.useMemo(() => ({ variants, tables, complete, loading, load }), [variants, tables, complete, loading, load]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useProductData() { return React.useContext(C); }
/** The selected configuration (from the buy box), or undefined. */
export function useSelectedLightVariant(): LightVariant | undefined {
  const ctx = React.useContext(C); const vid = useSelectedVariant(); return ctx?.variants.find((v) => v.id === vid);
}
