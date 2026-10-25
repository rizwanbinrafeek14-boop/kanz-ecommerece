// Step 1: turn a reviewed kanz-catalogue-extraction/1 file into import payloads (same SKUs/labels/descriptions as the admin import).
// usage (from web/): npx jiti scripts/catalogue-sql/payloads.ts <extraction.json> <payloads.json> <brand-slug>
import { readFileSync, writeFileSync } from "node:fs";
import { ExtractionFileSchema } from "../../src/lib/catalogue/schema";
import { validateExtracted, hasErrors } from "../../src/lib/catalogue/validate";
import { describe, buildVariants, buildOptions } from "../../src/lib/catalogue/prepare";
const [file, outFile, brand] = process.argv.slice(2);
const f = ExtractionFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const taken = new Set<string>(); const out = [];
for (const p of f.products) {
  if (hasErrors(validateExtracted(p))) throw new Error("validation errors in " + p.name_en);
  const slug = `${brand}-${p.family.key}`;
  const tables = p.dimension_tables.map((t, n) => ({ title_en: t.title_en, title_ar: t.title_ar ?? null, columns: t.columns, applies: t.applies, rows: t.rows, notes: t.notes, source_page: t.page, drawing_path: t.drawing ? `catalogue/${slug}/drawing-${n + 1}.webp` : null, crop: t.drawing ?? null }));
  const images = p.images.map((im, n) => {
    const same = tables.find((t) => t.crop && t.crop.page === im.page && JSON.stringify(t.crop.bbox) === JSON.stringify(im.bbox));
    return { storage_path: same?.drawing_path ?? `catalogue/${slug}/${n + 1}.webp`, alt_en: im.alt_en, alt_ar: im.alt_ar ?? null, is_primary: n === 0, sort_order: n, crop: { page: im.page, bbox: im.bbox } };
  });
  out.push({
    family: { slug: p.family.key, name_en: p.family.name_en, name_ar: p.family.name_ar ?? null, product_type: p.family.type ?? null },
    product: { slug, name_en: p.name_en, name_ar: p.name_ar ?? null, ...describe(p), category_slug: p.category_slug, manufacturer_ref: p.manufacturer_ref ?? null, country_of_origin: p.country ?? null,
      applications_en: p.applications_en.join("\n") || null, specs: { standards: p.standards, materials: p.materials, notes: p.notes }, source_ref: { title: f.source_title, pages: p.pages } },
    options: buildOptions(p), variants: buildVariants(p, taken), dimension_tables: tables, images,
  });
}
writeFileSync(outFile, JSON.stringify(out));
console.log(out.length, "products", out.reduce((a, x) => a + x.variants.length, 0), "variants");
