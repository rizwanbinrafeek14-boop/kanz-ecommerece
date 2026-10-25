/** Merge two extractions of the same product family from different pages (e.g. product list + dimension table + weight list). */
import type { ExtractedProduct } from "./schema";

const uniqBy = <T,>(xs: T[], k: (x: T) => string) => { const m = new Map<string, T>(); for (const x of xs) if (!m.has(k(x))) m.set(k(x), x); return [...m.values()]; };

export function mergeExtracted(a: ExtractedProduct, b: ExtractedProduct): ExtractedProduct {
  const options = [...a.options];
  for (const ob of b.options) {
    const oa = options.find((o) => o.key === ob.key);
    if (!oa) options.push(ob); else oa.values = uniqBy([...oa.values, ...ob.values], (v) => v.value);
  }
  const keys = options.map((o) => o.key);
  // Variants from the two parts are combined by their option values; a variant missing a newly introduced option is kept for review (validation flags it).
  const variants = uniqBy([...a.variants, ...b.variants].map((v) => ({ ...v })), (v) => keys.map((k) => v.options[k] ?? "").join("|"));
  for (const v of variants) {
    const other = [...a.variants, ...b.variants].find((w) => w !== v && keys.every((k) => (w.options[k] ?? "") === (v.options[k] ?? "")));
    if (other) { v.weight_kg ??= other.weight_kg; v.manufacturer_code ??= other.manufacturer_code; }
  }
  return {
    ...a,
    name_ar: a.name_ar ?? b.name_ar, category_slug: a.category_slug ?? b.category_slug, manufacturer_ref: a.manufacturer_ref ?? b.manufacturer_ref,
    short_en: a.short_en ?? b.short_en, description_en: a.description_en ?? b.description_en, country: a.country ?? b.country,
    applications_en: [...new Set([...a.applications_en, ...b.applications_en])],
    standards: uniqBy([...a.standards, ...b.standards], (s) => `${s.code}|${s.scope}`),
    materials: uniqBy([...a.materials, ...b.materials], (m) => `${m.type}|${m.grades.join(",")}`),
    options, variants,
    dimension_tables: [...a.dimension_tables, ...b.dimension_tables],
    images: [...a.images, ...b.images].slice(0, 20),
    notes: [...new Set([...a.notes, ...b.notes])], warnings: [...a.warnings, ...b.warnings],
    pages: [...new Set([...a.pages, ...b.pages])].sort((x, y) => x - y),
    confidence: Math.min(a.confidence, b.confidence),
  };
}
