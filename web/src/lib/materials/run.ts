import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectMaterials } from "./detect";

export interface ReportRow { id: string; name: string; brand: string | null; status: string; materials: { code: string; status: string; grades: number }[]; conflicts: string[] }
export interface MaterialReport {
  scanned: number; classified: ReportRow[]; multiple: ReportRow[]; needsVerification: ReportRow[]; missingGrades: ReportRow[]; conflicts: ReportRow[];
  written: number; removed: number; keptByAdmin: number; variantsSet: number;
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999); if (error) throw new Error(error.message);
    out.push(...(data ?? [])); if (!data || data.length < 1000) return out;
  }
}

/**
 * Run the automatic detection over the given products (default: all) and, unless dryRun, store the result.
 * Rows an admin verified, rejected or edited are never changed; variant material codes are only filled in when empty.
 */
export async function runDetection(sb: SupabaseClient, opts: { dryRun: boolean; productIds?: string[] }): Promise<MaterialReport> {
  const ids = opts.productIds;
  const [prods, attrs, vars, existing] = await Promise.all([
    all<any>((a, b) => { let q = sb.from("products").select("id, name_en, short_desc_en, description_en, specs, status, brands(name)").order("id").range(a, b); if (ids) q = q.in("id", ids); return q; }),
    all<any>((a, b) => { let q = sb.from("product_attribute_values").select("product_id, value_en, attribute_defs!inner(key)").in("attribute_defs.key", ["material", "grade"]).order("product_id").range(a, b); if (ids) q = q.in("product_id", ids); return q; }),
    all<any>((a, b) => { let q = sb.from("product_variants").select("id, product_id, material, grade, material_code").order("id").range(a, b); if (ids) q = q.in("product_id", ids); return q; }),
    all<any>((a, b) => { let q = sb.from("product_materials").select("id, product_id, material_code, status, grades, edited_by_admin, origin").order("id").range(a, b); if (ids) q = q.in("product_id", ids); return q; }),
  ]);
  const by = <T extends { product_id: string }>(rows: T[]) => { const m = new Map<string, T[]>(); for (const r of rows) m.set(r.product_id, [...(m.get(r.product_id) ?? []), r]); return m; };
  const A = by(attrs), V = by(vars), E = by(existing);
  const rep: MaterialReport = { scanned: prods.length, classified: [], multiple: [], needsVerification: [], missingGrades: [], conflicts: [], written: 0, removed: 0, keptByAdmin: 0, variantsSet: 0 };
  const upserts: any[] = []; const deletes: string[] = []; const variantSets: { id: string; code: string }[] = [];

  for (const p of prods) {
    const det = detectMaterials({
      name: p.name_en, shortDesc: p.short_desc_en, description: p.description_en,
      attributes: (A.get(p.id) ?? []).map((a: any) => ({ key: (Array.isArray(a.attribute_defs) ? a.attribute_defs[0] : a.attribute_defs).key, value: a.value_en })),
      variants: (V.get(p.id) ?? []).map((v: any) => ({ id: v.id, material: v.material, grade: v.grade })),
      specMaterials: Array.isArray(p.specs?.materials) ? p.specs.materials : [],
    });
    const have = new Map((E.get(p.id) ?? []).map((r: any) => [r.material_code, r]));
    const final = new Map<string, { status: string; grades: number }>();
    // rows an admin decided, or written by a catalogue import (origin 'import'), are never changed by detection
    const locked = (r: any) => r.edited_by_admin || r.status === "verified" || r.status === "rejected" || (r.origin && r.origin !== "detection");
    for (const r of have.values()) if (locked(r)) { final.set(r.material_code, { status: r.status, grades: r.grades?.length ?? 0 }); rep.keptByAdmin++; }
    for (const f of det.materials) {
      const cur = have.get(f.code);
      if (cur && locked(cur)) continue;
      upserts.push({ product_id: p.id, material_code: f.code, grades: f.grades, status: f.status, source: f.source, note: f.note ?? null, updated_at: new Date().toISOString() });
      final.set(f.code, { status: f.status, grades: f.grades.length });
    }
    for (const r of have.values()) if (!locked(r) && !det.materials.some((f) => f.code === r.material_code)) deletes.push(r.id);
    const vmap = new Map((V.get(p.id) ?? []).map((v: any) => [v.id, v]));
    for (const v of det.variants) if (!vmap.get(v.variantId)?.material_code) variantSets.push({ id: v.variantId, code: v.code });

    const mats = [...final].map(([code, x]) => ({ code, ...x }));
    const pub = mats.filter((m) => m.status === "auto" || m.status === "verified");
    const row: ReportRow = { id: p.id, name: p.name_en, brand: (Array.isArray(p.brands) ? p.brands[0] : p.brands)?.name ?? null, status: p.status, materials: mats, conflicts: det.conflicts };
    if (pub.length) rep.classified.push(row);
    if (pub.length > 1) rep.multiple.push(row);
    if (!pub.length || mats.some((m) => m.status === "unverified")) rep.needsVerification.push(row);
    if (pub.some((m) => m.grades === 0 && m.code !== "GI" && !/^(HDPE|PVC|CPVC|PPR|OTHER)$/.test(m.code))) rep.missingGrades.push(row);
    if (det.conflicts.length) rep.conflicts.push(row);
  }
  if (!opts.dryRun) {
    for (let i = 0; i < upserts.length; i += 500) { const { error } = await sb.from("product_materials").upsert(upserts.slice(i, i + 500), { onConflict: "product_id,material_code" }); if (error) throw new Error(error.message); }
    for (let i = 0; i < deletes.length; i += 200) await sb.from("product_materials").delete().in("id", deletes.slice(i, i + 200)).eq("edited_by_admin", false).eq("origin", "detection").in("status", ["auto", "unverified"]);
    const byCode = new Map<string, string[]>(); for (const v of variantSets) byCode.set(v.code, [...(byCode.get(v.code) ?? []), v.id]);
    for (const [code, vids] of byCode) for (let i = 0; i < vids.length; i += 200) await sb.from("product_variants").update({ material_code: code }).in("id", vids.slice(i, i + 200)).is("material_code", null);
  }
  rep.written = upserts.length; rep.removed = deletes.length; rep.variantsSet = variantSets.length;
  return rep;
}
