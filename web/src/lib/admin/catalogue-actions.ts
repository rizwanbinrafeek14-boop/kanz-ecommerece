"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExtractedProductSchema, ExtractionFileSchema, type ExtractedProduct } from "@/lib/catalogue/schema";
import { hasErrors, validateExtracted } from "@/lib/catalogue/validate";
import { mergeExtracted } from "@/lib/catalogue/merge";
import { brandCode, buildOptions, buildVariants, describe, normalizeName } from "@/lib/catalogue/prepare";
import { claudeConfigured, extractPage } from "@/lib/catalogue/claude";
import { audit, fail, ok, refreshStorefront, uniqueSlug, type Result } from "./common";

const pagePath = (sourceId: string, n: number) => `catalogue/${sourceId}/p${n}.png`;
const done = (sourceId?: string) => { revalidatePath("/admin/catalogue"); if (sourceId) revalidatePath(`/admin/catalogue/${sourceId}`); };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "brand";

// ───────── Sources & pages ─────────
const sourceSchema = z.object({
  title: z.string().trim().min(2).max(200), brand_id: z.string().uuid().nullable(), new_brand: z.string().trim().max(120).nullable(),
  file_path: z.string().regex(/^sources\/[0-9a-f-]{36}\.pdf$/), file_size: z.number().int().positive().max(50 * 1024 * 1024), page_count: z.number().int().min(1).max(2000),
});
export async function createSource(input: z.input<typeof sourceSchema>): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const p = sourceSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const sb = await createClient();
  let brandId = d.brand_id;
  if (!brandId && d.new_brand) {
    const { data: existing } = await sb.from("brands").select("id").ilike("name", d.new_brand).maybeSingle();
    if (existing) brandId = existing.id;
    else { const slug = await uniqueSlug(sb, "brands", slugify(d.new_brand)); const { data, error } = await sb.from("brands").insert({ name: d.new_brand, slug, is_active: false }).select("id").single(); if (error) return fail(error.message); brandId = data.id; }
  }
  if (!brandId) return fail("Choose the manufacturer or type a new one.");
  const { data, error } = await sb.from("catalogue_sources").insert({ title: d.title, brand_id: brandId, file_path: d.file_path, file_size: d.file_size, page_count: d.page_count, status: "processing", created_by: user.id }).select("id").single();
  if (error) return fail(error.message);
  await sb.from("catalogue_pages").insert(Array.from({ length: d.page_count }, (_, i) => ({ source_id: data.id, page_no: i + 1 })));
  await audit(sb, user.id, "catalogue.upload", "catalogue_sources", data.id, { title: d.title });
  done(); return ok({ id: data.id });
}

/** Called by the browser after it rendered a page (image already uploaded to import-staging) and read its text layer. */
export async function savePageRender(sourceId: string, pageNo: number, text: string): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("catalogue_pages").update({ status: "rendered", image_path: pagePath(sourceId, pageNo), text_content: text.slice(0, 200000), updated_at: new Date().toISOString() })
    .eq("source_id", sourceId).eq("page_no", pageNo).in("status", ["pending", "failed", "rendered"]);
  if (error) return fail(error.message); return ok(null);
}
export async function setPageStatus(sourceId: string, pageNo: number, status: "skipped" | "needs_review" | "pending", reason: string | null): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("catalogue_pages").update({ status, skip_reason: reason?.slice(0, 1000) ?? null, updated_at: new Date().toISOString() }).eq("source_id", sourceId).eq("page_no", pageNo);
  if (error) return fail(error.message); done(sourceId); return ok(null);
}
export async function deleteSource(id: string): Promise<Result> {
  await requireAdmin(); const sb = await createClient();
  const { data: src } = await sb.from("catalogue_sources").select("file_path").eq("id", id).maybeSingle();
  const { data: pages } = await sb.from("catalogue_pages").select("image_path").eq("source_id", id);
  const { error } = await sb.from("catalogue_sources").delete().eq("id", id); if (error) return fail(error.message);
  if (src?.file_path) await sb.storage.from("catalogue-sources").remove([src.file_path]);
  const imgs = (pages ?? []).map((p) => p.image_path).filter(Boolean) as string[]; if (imgs.length) await sb.storage.from("import-staging").remove(imgs);
  done(); return ok(null);   // imported products are kept
}

// ───────── Storing extracted products (merge per family, validate, detect duplicates) ─────────
async function detectDuplicate(sb: SupabaseClient, p: ExtractedProduct, brandId: string | null) {
  const { data: fam } = await sb.from("product_families").select("id, slug").eq("slug", p.family.key).maybeSingle();
  const { data: candidates } = await sb.from("products").select("id, name_en, slug, brand_id, family_id, product_variants(count)").limit(2000);
  const norm = normalizeName(p.name_en, p.manufacturer);
  const same = (candidates ?? []).find((c) => c.brand_id === brandId && brandId && ((fam && c.family_id === fam.id) || normalizeName(c.name_en, p.manufacturer) === norm));
  const otherMakers = fam ? (candidates ?? []).filter((c) => c.family_id === fam.id && c.brand_id !== brandId).length : 0;
  if (!same) return { duplicate_of: null, duplicate_info: otherMakers ? { kind: "family", message: `${otherMakers} product(s) from other manufacturers share this family; they will be linked, never merged.` } : null };
  const existingVariants = (same.product_variants as unknown as { count: number }[])?.[0]?.count ?? 0;
  return { duplicate_of: same.id, duplicate_info: { kind: "duplicate", message: `This manufacturer already has “${same.name_en}” on the site (${existingVariants} variants; this extraction has ${p.variants.length}). Importing creates a separate draft; existing specifications are never overwritten.`, existing: { id: same.id, slug: same.slug, name: same.name_en, variants: existingVariants } } };
}

async function saveWarnings(sb: SupabaseClient, sourceId: string, id: string, p: ExtractedProduct) {
  const issues = validateExtracted(p);
  await sb.from("extraction_warnings").delete().eq("extracted_product_id", id);
  if (issues.length) await sb.from("extraction_warnings").insert(issues.slice(0, 500).map((i) => ({ source_id: sourceId, extracted_product_id: id, page_no: i.page ?? null, severity: i.severity, code: i.code, message: i.message })));
  return issues;
}

async function storeProducts(sb: SupabaseClient, sourceId: string, brandId: string | null, products: ExtractedProduct[]) {
  const { data: pending } = await sb.from("extracted_products").select("id, data").eq("source_id", sourceId).in("status", ["pending"]);
  const byFamily = new Map((pending ?? []).map((r) => [(r.data as ExtractedProduct).family?.key, r]));
  let created = 0, merged = 0;
  for (const raw of products) {
    const existing = byFamily.get(raw.family.key);
    const p = existing ? mergeExtracted(ExtractedProductSchema.parse(existing.data), raw) : raw;
    const dup = await detectDuplicate(sb, p, brandId);
    const row = { data: p, pages: p.pages, confidence: p.confidence, duplicate_of: dup.duplicate_of, duplicate_info: dup.duplicate_info, updated_at: new Date().toISOString() };
    let id: string;
    if (existing) { await sb.from("extracted_products").update(row).eq("id", existing.id); id = existing.id; merged++; }
    else { const { data, error } = await sb.from("extracted_products").insert({ ...row, source_id: sourceId }).select("id").single(); if (error) throw new Error(error.message); id = data.id; created++; byFamily.set(p.family.key, { id, data: p }); }
    await saveWarnings(sb, sourceId, id, p);
  }
  return { created, merged };
}

/** Load a hand-checked extraction file (format kanz-catalogue-extraction/1) into the review area. */
export async function loadExtractionFile(sourceId: string, fileText: string): Promise<Result<{ created: number; merged: number; pages: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  let parsed; try { parsed = ExtractionFileSchema.safeParse(JSON.parse(fileText)); } catch { return fail("The file is not valid JSON."); }
  if (!parsed.success) return fail(`The file does not match the extraction format: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const f = parsed.data;
  const { data: src } = await sb.from("catalogue_sources").select("id, brand_id, page_count").eq("id", sourceId).single();
  if (!src) return fail("Catalogue not found.");
  if (src.page_count && f.page_count !== src.page_count) return fail(`This file describes a ${f.page_count}-page catalogue but the uploaded PDF has ${src.page_count} pages.`);
  try {
    const r = await storeProducts(sb, sourceId, src.brand_id, f.products);
    for (const pg of f.pages) await sb.from("catalogue_pages").update({ status: pg.status, method: pg.method, skip_reason: pg.status === "skipped" ? pg.note ?? null : null, error: pg.status === "needs_review" ? pg.note ?? null : null, products_found: f.products.filter((p) => p.pages.includes(pg.page)).length, updated_at: new Date().toISOString() }).eq("source_id", sourceId).eq("page_no", pg.page);
    await sb.from("catalogue_sources").update({ status: "reviewing", updated_at: new Date().toISOString() }).eq("id", sourceId);
    await audit(sb, user.id, "catalogue.load_file", "catalogue_sources", sourceId, { products: f.products.length });
    done(sourceId); return ok({ ...r, pages: f.pages.length });
  } catch (e) { return fail((e as Error).message); }
}

/** Extract one rendered page with Claude (needs ANTHROPIC_API_KEY). The result goes to the review area, never straight to the shop. */
export async function extractPageWithClaude(sourceId: string, pageNo: number): Promise<Result<{ products: number; status: string; invalid: number; tokens: { input: number; output: number } }>> {
  await requireStaff();
  if (!claudeConfigured()) return fail("Claude extraction is not configured: add ANTHROPIC_API_KEY to the server environment (see the setup guide).");
  const sb = await createClient();
  const [{ data: src }, { data: pg }] = await Promise.all([
    sb.from("catalogue_sources").select("id, title, brand_id, brands(name)").eq("id", sourceId).single(),
    sb.from("catalogue_pages").select("image_path, text_content").eq("source_id", sourceId).eq("page_no", pageNo).single(),
  ]);
  if (!src || !pg?.image_path) return fail("Render the page first.");
  const { data: blob, error: dlErr } = await sb.storage.from("import-staging").download(pg.image_path);
  if (dlErr || !blob) return fail("Could not read the page image.");
  const { data: fams } = await sb.from("extracted_products").select("data->family->>key").eq("source_id", sourceId);
  const manufacturer = (Array.isArray(src.brands) ? src.brands[0] : src.brands as { name: string } | null)?.name ?? "Unknown";
  try {
    const r = await extractPage({ image: Buffer.from(await blob.arrayBuffer()), text: pg.text_content ?? "", page: pageNo, manufacturer, sourceTitle: src.title, knownFamilies: [...new Set((fams ?? []).map((f) => Object.values(f)[0] as string).filter(Boolean))] });
    const products = r.products.map((p) => ({ ...p, manufacturer, pages: p.pages.length ? p.pages : [pageNo] }));
    await storeProducts(sb, sourceId, src.brand_id, products);
    const status = r.invalid.length ? "needs_review" : r.status;
    await sb.from("catalogue_pages").update({ status, method: "vision", products_found: products.length, skip_reason: r.status === "skipped" ? r.note : null, error: r.invalid.length ? `${r.invalid.length} product(s) did not pass validation: ${r.invalid.map((x) => x.error).join(" | ").slice(0, 900)}` : r.status === "needs_review" ? r.note : null, updated_at: new Date().toISOString() }).eq("source_id", sourceId).eq("page_no", pageNo);
    done(sourceId); return ok({ products: products.length, status, invalid: r.invalid.length, tokens: r.usage });
  } catch (e) {
    await sb.from("catalogue_pages").update({ status: "failed", error: (e as Error).message.slice(0, 1000), updated_at: new Date().toISOString() }).eq("source_id", sourceId).eq("page_no", pageNo);
    return fail((e as Error).message);
  }
}

// ───────── Review ─────────
export async function updateExtracted(id: string, data: unknown): Promise<Result<{ errors: number; warnings: number }>> {
  await requireStaff(); const sb = await createClient();
  const p = ExtractedProductSchema.safeParse(data); if (!p.success) return fail(p.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { data: row } = await sb.from("extracted_products").select("source_id, status, catalogue_sources(brand_id)").eq("id", id).single();
  if (!row) return fail("Record not found."); if (row.status === "imported") return fail("Already imported: edit the product itself instead.");
  const brandId = (Array.isArray(row.catalogue_sources) ? row.catalogue_sources[0] : row.catalogue_sources as { brand_id: string | null } | null)?.brand_id ?? null;
  const dup = await detectDuplicate(sb, p.data, brandId);
  await sb.from("extracted_products").update({ data: p.data, pages: p.data.pages, confidence: p.data.confidence, duplicate_of: dup.duplicate_of, duplicate_info: dup.duplicate_info, status: row.status === "approved" ? "pending" : row.status, updated_at: new Date().toISOString() }).eq("id", id);
  const issues = await saveWarnings(sb, row.source_id, id, p.data);
  done(row.source_id); return ok({ errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warning").length });
}

export async function setExtractedStatus(ids: string[], status: "approved" | "rejected" | "pending"): Promise<Result<{ changed: number; blocked: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: rows } = await sb.from("extracted_products").select("id, source_id, data, status").in("id", ids.slice(0, 500));
  let changed = 0, blocked = 0;
  for (const r of rows ?? []) {
    if (r.status === "imported") { blocked++; continue; }
    if (status === "approved") { const p = ExtractedProductSchema.safeParse(r.data); if (!p.success || hasErrors(validateExtracted(p.data))) { blocked++; continue; } }
    await sb.from("extracted_products").update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", r.id); changed++;
  }
  done(rows?.[0]?.source_id); return ok({ changed, blocked });
}

// ───────── Import approved records as unpublished draft products ─────────
async function cropTo(sb: SupabaseClient, sourceId: string, pageNo: number, bbox: [number, number, number, number], dest: string, cache: Map<number, Buffer>) {
  let png = cache.get(pageNo);
  if (!png) { const { data } = await sb.storage.from("import-staging").download(pagePath(sourceId, pageNo)); if (!data) throw new Error(`Page ${pageNo} has not been rendered.`); png = Buffer.from(await data.arrayBuffer()); cache.set(pageNo, png); }
  const meta = await sharp(png).metadata(); const W = meta.width ?? 0, H = meta.height ?? 0;
  const [x0, y0, x1, y1] = bbox; const left = Math.max(0, Math.floor(x0 * W)), top = Math.max(0, Math.floor(y0 * H));
  const width = Math.min(W - left, Math.ceil((x1 - x0) * W)), height = Math.min(H - top, Math.ceil((y1 - y0) * H));
  if (width < 24 || height < 24) throw new Error(`Image area on page ${pageNo} is too small.`);
  const crop = sharp(png).extract({ left, top, width, height });
  const { data: out, info } = await crop.clone().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const { error } = await sb.storage.from("product-images").upload(dest, out, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(error.message);
  // listing thumbnail (only when the crop is larger than one)
  let thumb: string | null = null;
  if (Math.max(info.width, info.height) > 600) {
    thumb = dest.replace(/\.webp$/, "-thumb.webp");
    const t = await crop.clone().resize({ width: 600, height: 600, fit: "inside" }).webp({ quality: 80 }).toBuffer();
    const { error: te } = await sb.storage.from("product-images").upload(thumb, t, { contentType: "image/webp", upsert: true });
    if (te) thumb = null;
  }
  return { path: dest, thumb, small: width < 400 && height < 400, width: info.width, height: info.height, bytes: out.length };
}

type ImportImage = { storage_path: string; thumb_path: string | null; alt_en: string; alt_ar: string | null; is_primary: boolean; sort_order: number; needs_hires: boolean;
  source: "catalogue"; kind: "photo" | "drawing"; width: number; height: number; bytes: number; source_note: string };

/**
 * Temporary images for an imported product, best first: the manufacturer's own product pictures from the catalogue, then — when the
 * catalogue has no picture of it — the product's dimensional drawing from the same catalogue. Nothing from another product or
 * manufacturer is ever used; with neither, the website shows the labelled placeholder until a photo is uploaded.
 */
function orderImages(images: Omit<ImportImage, "is_primary" | "sort_order">[]): ImportImage[] {
  const sorted = [...images.filter((i) => i.kind === "photo"), ...images.filter((i) => i.kind === "drawing")];
  return sorted.map((i, n) => ({ ...i, is_primary: n === 0, sort_order: n }));
}

export async function importApproved(sourceId: string, ids: string[]): Promise<Result<{ imported: number; failed: { id: string; name: string; error: string }[]; images: { photo: number; drawing: number; none: number } }>> {
  const user = await requireStaff(); const sb = await createClient();
  const [{ data: src }, { data: rows }, { data: cats }] = await Promise.all([
    sb.from("catalogue_sources").select("id, title, brand_id, brands(slug, name)").eq("id", sourceId).single(),
    sb.from("extracted_products").select("id, data, status").eq("source_id", sourceId).in("id", ids.slice(0, 200)).eq("status", "approved"),
    sb.from("categories").select("id, slug"),
  ]);
  if (!src) return fail("Catalogue not found.");
  const brand = (Array.isArray(src.brands) ? src.brands[0] : src.brands) as { slug: string; name: string } | null;
  const catId = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  const imported: string[] = []; const failed: { id: string; name: string; error: string }[] = []; const cache = new Map<number, Buffer>();
  const imageKinds = { photo: 0, drawing: 0, none: 0 };   // what each imported product shows until a photo is uploaded
  for (const r of rows ?? []) {
    const parsed = ExtractedProductSchema.safeParse(r.data);
    if (!parsed.success) { failed.push({ id: r.id, name: "?", error: "Invalid data" }); continue; }
    const p = parsed.data;
    if (hasErrors(validateExtracted(p))) { failed.push({ id: r.id, name: p.name_en, error: "Has validation errors" }); continue; }
    try {
      const slug = await uniqueSlug(sb, "products", `${brand?.slug ?? slugify(p.manufacturer)}-${p.family.key}`);
      const code = brandCode(p.manufacturer);
      const { data: skus } = await sb.from("product_variants").select("sku").ilike("sku", `${code}-%`);
      const variants = buildVariants(p, new Set((skus ?? []).map((s) => s.sku.toLowerCase())));
      const note = (pg: number) => `${src.title}, page ${pg}`.slice(0, 300);
      const found: Omit<ImportImage, "is_primary" | "sort_order">[] = [];
      for (const [n, im] of p.images.entries()) {
        const c = await cropTo(sb, sourceId, im.page, im.bbox, `catalogue/${slug}/${n + 1}-${randomUUID().slice(0, 8)}.webp`, cache);
        found.push({ storage_path: c.path, thumb_path: c.thumb, alt_en: im.alt_en, alt_ar: im.alt_ar ?? null, needs_hires: c.small, source: "catalogue", kind: im.kind, width: c.width, height: c.height, bytes: c.bytes, source_note: note(im.page) });
      }
      const tables = []; const tableDrawings: typeof found = [];
      for (const [n, t] of p.dimension_tables.entries()) {
        const c = t.drawing ? await cropTo(sb, sourceId, t.drawing.page, t.drawing.bbox, `catalogue/${slug}/drawing-${n + 1}-${randomUUID().slice(0, 8)}.webp`, cache) : null;
        if (c) tableDrawings.push({ storage_path: c.path, thumb_path: c.thumb, alt_en: `${p.name_en} — ${t.title_en}`.slice(0, 200), alt_ar: null, needs_hires: c.small, source: "catalogue", kind: "drawing", width: c.width, height: c.height, bytes: c.bytes, source_note: note(t.drawing!.page) });
        tables.push({ title_en: t.title_en, title_ar: t.title_ar ?? null, columns: t.columns, applies: t.applies, rows: t.rows, notes: t.notes, source_page: t.page, drawing_path: c?.path ?? null });
      }
      // no picture of the product in the catalogue: its own dimensional drawing is the temporary image (the file is shared with the table)
      const images = orderImages(found.length ? found : tableDrawings.slice(0, 1));
      const text = describe(p);
      const payload = {
        family: { slug: p.family.key, name_en: p.family.name_en, name_ar: p.family.name_ar ?? null, product_type: p.family.type ?? null, category_id: p.category_slug ? catId.get(p.category_slug) ?? null : null },
        product: {
          slug, name_en: p.name_en, name_ar: p.name_ar ?? null, ...text,
          category_id: p.category_slug ? catId.get(p.category_slug) ?? null : null, brand_id: src.brand_id, manufacturer_ref: p.manufacturer_ref ?? null, country_of_origin: p.country ?? null,
          applications_en: p.applications_en.join("\n") || null, applications_ar: null,
          specs: { standards: p.standards, materials: p.materials, notes: p.notes },
          source_ref: { source_id: sourceId, title: src.title, pages: p.pages },
        },
        options: buildOptions(p), variants, dimension_tables: tables, images,
      };
      const { data: pid, error } = await sb.rpc("catalogue_import_product", { p_extracted: r.id, p: payload });
      if (error) throw new Error(error.message);
      // where each image came from, its thumbnail and size (kept separately from the product, replaceable later)
      if (images.length) { const { error: ie } = await sb.rpc("catalogue_import_images", { p_product: pid, p: images }); if (ie) throw new Error(ie.message); }
      imageKinds[images[0]?.kind ?? "none"]++;
      imported.push(pid as string);
    } catch (e) { failed.push({ id: r.id, name: p.name_en, error: (e as Error).message }); }
  }
  // classify the new products' materials straight away (same rules as Admin → Materials; never touches admin decisions)
  if (imported.length) { try { const { runDetection } = await import("@/lib/materials/run"); await runDetection(sb, { dryRun: false, productIds: imported }); } catch { /* detection can be re-run from Admin → Materials */ } }
  await sb.from("catalogue_import_runs").insert({ source_id: sourceId, created_by: user.id, summary: { imported: imported.length, failed, product_ids: imported, images: imageKinds } });
  await audit(sb, user.id, "catalogue.import", "catalogue_sources", sourceId, { imported: imported.length, failed: failed.length });
  refreshStorefront(); done(sourceId); revalidatePath("/admin/products");
  return ok({ imported: imported.length, failed, images: imageKinds });
}
