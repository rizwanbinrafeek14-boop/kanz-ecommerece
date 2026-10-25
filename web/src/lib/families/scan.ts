import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchOffering, type MatchInput } from "./match";

/** Recompute match suggestions for every offering still waiting for a decision (called when the families page opens). */
export async function scanSuggestions(sb: SupabaseClient): Promise<number> {
  const { data: prods } = await sb.from("products").select("id, name_en, family_id, family_link, family_sort, created_at, specs, brands(name), product_options(key, product_option_values(value))").not("family_id", "is", null);
  if (!prods?.length) return 0;
  type Row = (typeof prods)[number];
  const toInput = (r: Row): MatchInput => {
    const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
    const opts = (r.product_options ?? []) as { key: string; product_option_values: { value: string }[] }[];
    const specs = r.specs as { standards?: { code: string; scope: string }[] } | null;
    return { id: r.id, name: r.name_en, brand: (brand as { name: string } | null)?.name ?? null, optionKeys: opts.map((o) => o.key), optionValues: Object.fromEntries(opts.map((o) => [o.key, o.product_option_values.map((v) => v.value)])),
      standards: (specs?.standards ?? []).filter((s) => s.scope === "product").map((s) => s.code) };
  };
  const byFamily = new Map<string, Row[]>();
  for (const r of prods) byFamily.set(r.family_id!, [...(byFamily.get(r.family_id!) ?? []), r]);
  const rows = [];
  for (const [fid, list] of byFamily) {
    // reference = first confirmed offering, otherwise the earliest product in the family
    const ref = [...list].sort((a, b) => (a.family_link === "confirmed" ? 0 : 1) - (b.family_link === "confirmed" ? 0 : 1) || a.family_sort - b.family_sort || a.created_at.localeCompare(b.created_at))[0];
    for (const r of list.filter((x) => x.family_link === "suggested")) {
      const m = matchOffering(toInput(r), toInput(ref));
      rows.push({ product_id: r.id, family_id: fid, confidence: m.confidence, reasons: m.reasons, status: "pending" });
    }
  }
  if (rows.length) await sb.from("family_link_suggestions").upsert(rows, { onConflict: "product_id,family_id" });
  return rows.length;
}
