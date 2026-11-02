import "server-only";
/**
 * Storing extracted products in the review area (shared by PDF and website catalogues; not a server action).
 * - PDF records of one product family are merged across pages; website records are keyed by their source (page + model)
 *   and a re-extracted page replaces its pending record.
 * - Duplicate detection: a website record whose source key was imported before is an UPDATE of that product, with a
 *   field-by-field preview; otherwise the same manufacturer + model / name is flagged as a possible duplicate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExtractedProductSchema, type ExtractedProduct } from "@/lib/catalogue/schema";
import { validateExtracted } from "@/lib/catalogue/validate";
import { mergeExtracted } from "@/lib/catalogue/merge";
import { describe, normalizeName } from "@/lib/catalogue/prepare";

/** Order-independent comparison: the database (jsonb) stores object keys in its own order, and absent / null / "" are the same. */
function canon(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (x === undefined || x === null || x === "") return null;
    if (Array.isArray(x)) return x.map(norm);
    if (typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, y]) => [k, norm(y)]).filter(([, y]) => y !== null && !(Array.isArray(y) && !y.length)).sort(([a], [b]) => (String(a) < String(b) ? -1 : 1)));
    return x;
  };
  const n = norm(v); return JSON.stringify(Array.isArray(n) && !n.length ? null : n);
}
export interface Change { field: string; label: string; current: string; proposed: string; applies: boolean }
const show = (v: unknown) => (v == null || (Array.isArray(v) && !v.length) ? "—" : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : Object.values(x as object).filter(Boolean).join(" ")) ).join("; ") : String(v)).slice(0, 2000);

/** What applying this record to an already imported product would change. Prices, stock, variants, images and status are never changed. */
async function changesFor(sb: SupabaseClient, productId: string, p: ExtractedProduct): Promise<Change[]> {
  const { data: cur } = await sb.from("products").select("name_en, short_desc_en, description_en, manufacturer_ref, specs, product_documents(external_url, source_url), product_variants(count)").eq("id", productId).maybeSingle();
  if (!cur) return [];
  const specs = (cur.specs ?? {}) as { properties?: unknown[]; standards?: unknown[]; materials?: unknown[] };
  const text = describe(p);
  const out: Change[] = [];
  const cmp = (field: string, label: string, a: unknown, b: unknown, applies = true) => { if (canon(a) !== canon(b)) out.push({ field, label, current: show(a), proposed: show(b), applies }); };
  cmp("description_en", "Description (English)", cur.description_en, text.description_en);
  cmp("short_desc_en", "Short description (English)", cur.short_desc_en, text.short_desc_en);
  cmp("manufacturer_ref", "Model / figure number", cur.manufacturer_ref, p.manufacturer_ref ?? null);
  cmp("properties", "Specification rows", specs.properties ?? [], p.properties);
  cmp("standards", "Standards", specs.standards ?? [], p.standards);
  cmp("materials", "Materials", specs.materials ?? [], p.materials);
  const have = new Set(((cur.product_documents ?? []) as { external_url: string | null; source_url: string | null }[]).flatMap((d) => [d.external_url, d.source_url]).filter(Boolean));
  const newDocs = p.documents.filter((d) => !have.has(d.url));
  if (newDocs.length) out.push({ field: "documents", label: "Documents to add", current: "—", proposed: newDocs.map((d) => d.title).join("; "), applies: true });
  const variants = (cur.product_variants as unknown as { count: number }[])?.[0]?.count ?? 0;
  if (variants !== p.variants.length) out.push({ field: "variants", label: "Variants (not changed automatically — edit the product)", current: String(variants), proposed: String(p.variants.length), applies: false });
  if (cur.name_en !== p.name_en) out.push({ field: "name_en", label: "Name (not changed automatically — your wording is kept)", current: cur.name_en, proposed: p.name_en, applies: false });
  return out;
}

async function detectDuplicate(sb: SupabaseClient, p: ExtractedProduct, brandId: string | null) {
  if (p.source_key && brandId) {
    const { data: prev } = await sb.rpc("products_by_source_keys", { p_brand: brandId, p_keys: [p.source_key] });
    const hit = (prev as { product_id: string; name_en: string; status: string }[] | null)?.[0];
    if (hit) {
      const changes = await changesFor(sb, hit.product_id, p);
      return { duplicate_of: hit.product_id, update_of: hit.product_id, changes,
        duplicate_info: { kind: "update", message: changes.some((c) => c.applies) ? `Already imported as “${hit.name_en}” (${hit.status}). ${changes.filter((c) => c.applies).length} field(s) differ — review the changes, then apply them.` : `Already imported as “${hit.name_en}” (${hit.status}); nothing has changed.`, existing: { id: hit.product_id, name: hit.name_en } } };
    }
  }
  const { data: fam } = await sb.from("product_families").select("id, slug").eq("slug", p.family.key).maybeSingle();
  const { data: candidates } = await sb.from("products").select("id, name_en, slug, brand_id, family_id, manufacturer_ref, product_variants(count)").eq("brand_id", brandId ?? "00000000-0000-0000-0000-000000000000").limit(5000);
  const norm = normalizeName(p.name_en, p.manufacturer); const ref = p.manufacturer_ref?.toLowerCase().replace(/\s+/g, "");
  // website records: the same model or the same name; PDF records: also the same family of the same manufacturer
  const same = (candidates ?? []).find((c) => (ref && c.manufacturer_ref?.toLowerCase().replace(/\s+/g, "") === ref) || normalizeName(c.name_en, p.manufacturer) === norm || (!p.source_key && fam && c.family_id === fam.id));
  let otherMakers = 0;
  if (fam) { const { count } = await sb.from("products").select("id", { count: "exact", head: true }).eq("family_id", fam.id).neq("brand_id", brandId ?? "00000000-0000-0000-0000-000000000000"); otherMakers = count ?? 0; }
  if (!same) return { duplicate_of: null, update_of: null, changes: null, duplicate_info: otherMakers ? { kind: "family", message: `${otherMakers} product(s) from other manufacturers share this family; they will be linked, never merged.` } : null };
  const existingVariants = (same.product_variants as unknown as { count: number }[])?.[0]?.count ?? 0;
  return { duplicate_of: same.id, update_of: null, changes: null, duplicate_info: { kind: "duplicate", message: `This manufacturer already has “${same.name_en}” on the site (${existingVariants} variants; this extraction has ${p.variants.length}). Importing creates a separate draft; existing specifications are never overwritten.`, existing: { id: same.id, slug: same.slug, name: same.name_en, variants: existingVariants } } };
}
export { detectDuplicate };

export async function saveWarnings(sb: SupabaseClient, sourceId: string, id: string, p: ExtractedProduct) {
  const issues = validateExtracted(p);
  await sb.from("extraction_warnings").delete().eq("extracted_product_id", id);
  if (issues.length) await sb.from("extraction_warnings").insert(issues.slice(0, 500).map((i) => ({ source_id: sourceId, extracted_product_id: id, page_no: i.page ?? null, severity: i.severity, code: i.code, message: i.message })));
  return issues;
}

const keyOf = (p: ExtractedProduct) => p.source_key ?? p.family.key;

/** Adds extracted products to the review area (caller has checked staff access). */
export async function storeProducts(sb: SupabaseClient, sourceId: string, brandId: string | null, products: ExtractedProduct[]) {
  const { data: pending } = await sb.from("extracted_products").select("id, data").eq("source_id", sourceId).in("status", ["pending"]);
  const byKey = new Map((pending ?? []).map((r) => [keyOf(r.data as ExtractedProduct), r]));
  let created = 0, merged = 0;
  for (const raw of products) {
    const existing = byKey.get(keyOf(raw));
    // a website page extracted again replaces its pending record; PDF pages of one family are merged
    const p = existing && !raw.source_key ? mergeExtracted(ExtractedProductSchema.parse(existing.data), raw) : raw;
    const dup = await detectDuplicate(sb, p, brandId);
    const row = { data: p, pages: p.pages, confidence: p.confidence, duplicate_of: dup.duplicate_of, duplicate_info: dup.duplicate_info, update_of: dup.update_of, changes: dup.changes, source_url: p.source_url ?? null, source_key: p.source_key ?? null, updated_at: new Date().toISOString() };
    let id: string;
    if (existing) { await sb.from("extracted_products").update(row).eq("id", existing.id); id = existing.id; merged++; }
    else { const { data, error } = await sb.from("extracted_products").insert({ ...row, source_id: sourceId }).select("id").single(); if (error) throw new Error(error.message); id = data.id; created++; byKey.set(keyOf(p), { id, data: p }); }
    await saveWarnings(sb, sourceId, id, p);
  }
  return { created, merged };
}
