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
import { brandCode, buildOptions, buildVariants, describe } from "@/lib/catalogue/prepare";
import { detectDuplicate, saveWarnings, storeProducts } from "./catalogue-store";
import { claudeConfigured, extractPage } from "@/lib/catalogue/claude";
import { audit, fail, ok, refreshStorefront, uniqueSlug, type Result } from "./common";
import { LIMITS, safeFetch } from "@/lib/catalogue/web";

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

// ───────── Storing extracted products: see catalogue-store.ts (merge / key, validate, duplicates, update preview) ─────────

/** Load a hand-checked extraction file (format kanz-catalogue-extraction/1) into the review area. */
export async function loadExtractionFile(sourceId: string, fileText: string): Promise<Result<{ created: number; merged: number; pages: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  let parsed; try { parsed = ExtractionFileSchema.safeParse(JSON.parse(fileText)); } catch { return fail("The file is not valid JSON."); }
  if (!parsed.success) return fail(`The file does not match the extraction format: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const f = parsed.data;
  const { data: src } = await sb.from("catalogue_sources").select("id, brand_id, page_count").eq("id", sourceId).single();
  if (!src) return fail("Catalogue not found.");
  if (src.page_count && f.page_count && f.page_count !== src.page_count) return fail(`This file describes a ${f.page_count}-page catalogue but the uploaded PDF has ${src.page_count} pages.`);
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
  await sb.from("extracted_products").update({ data: p.data, pages: p.data.pages, confidence: p.data.confidence, duplicate_of: dup.duplicate_of, duplicate_info: dup.duplicate_info, update_of: dup.update_of, changes: dup.changes, status: row.status === "approved" ? "pending" : row.status, updated_at: new Date().toISOString() }).eq("id", id);
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
  source: "catalogue" | "manufacturer"; kind: "photo" | "drawing"; width: number; height: number; bytes: number; source_note: string };

/**
 * Temporary images for an imported product, best first: the manufacturer's own product pictures from the catalogue, then — when the
 * catalogue has no picture of it — the product's dimensional drawing from the same catalogue. Nothing from another product or
 * manufacturer is ever used; with neither, the website shows the labelled placeholder until a photo is uploaded.
 */
function orderImages(images: Omit<ImportImage, "is_primary" | "sort_order">[]): ImportImage[] {
  const sorted = [...images.filter((i) => i.kind === "photo"), ...images.filter((i) => i.kind === "drawing")];
  return sorted.map((i, n) => ({ ...i, is_primary: n === 0, sort_order: n }));
}

type ImportSummary = { imported: number; updatesWaiting: number; duplicates: number; failed: { id: string; name: string; error: string }[]; images: { photo: number; drawing: number; none: number };
  files: { imagesStored: number; imagesLinkOnly: number; imagesFailed: number; docsStored: number; docsLinked: number; docsFailed: number } };

/** Downloads a manufacturer image (permission confirmed on the source) and stores it as WebP + thumbnail, like an upload. */
async function storeWebImage(sb: SupabaseClient, url: string, dest: string) {
  const r = await safeFetch(url, { accept: "image", maxBytes: LIMITS.image });
  if (!r.body) throw new Error(`HTTP ${r.status}`);
  if (!/^image\//.test(r.contentType)) throw new Error(`Not an image (${r.contentType || "unknown type"})`);
  const img = sharp(r.body, { limitInputPixels: 80_000_000 }).rotate();
  const meta = await img.metadata(); if (!meta.width || !meta.height) throw new Error("The image could not be read");
  const { data: out, info } = await img.clone().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const { error } = await sb.storage.from("product-images").upload(dest, out, { contentType: "image/webp", upsert: true }); if (error) throw new Error(error.message);
  let thumb: string | null = null;
  if (Math.max(info.width, info.height) > 600) {
    thumb = dest.replace(/\.webp$/, "-thumb.webp");
    const t = await img.clone().resize({ width: 600, height: 600, fit: "inside" }).webp({ quality: 80 }).toBuffer();
    if ((await sb.storage.from("product-images").upload(thumb, t, { contentType: "image/webp", upsert: true })).error) thumb = null;
  }
  return { path: dest, thumb, width: info.width, height: info.height, bytes: out.length, small: Math.max(meta.width, meta.height) < 800 };
}

/** Attaches a product's documents: a stored copy when copying is permitted (PDF only), otherwise a link to the manufacturer's file. */
async function attachDocuments(sb: SupabaseClient, productId: string, base: string, docs: ExtractedProduct["documents"], copy: boolean, files: ImportSummary["files"], notes: string[]) {
  for (const d of docs) {
    const kind = d.kind === "certificate" ? "certificate" : d.kind === "datasheet" || d.kind === "drawing" || d.kind === "catalogue" ? "datasheet" : "other";
    try {
      if (copy) {
        const r = await safeFetch(d.url, { accept: "document", maxBytes: LIMITS.document });
        if (r.body && r.body.subarray(0, 5).toString() === "%PDF-") {
          const path = `${base}/${(d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document").slice(0, 60)}-${randomUUID().slice(0, 6)}.pdf`;
          const { error } = await sb.storage.from("product-docs").upload(path, r.body, { contentType: "application/pdf", upsert: false }); if (error) throw new Error(error.message);
          await sb.from("product_documents").insert({ product_id: productId, kind, title: d.title, storage_path: path, source_url: d.url, is_public: true });
          files.docsStored++; continue;
        }
        notes.push(`Document “${d.title}” is not a PDF or could not be downloaded (${r.body ? "not a PDF" : `HTTP ${r.status}`}); linked instead.`);
      }
      if (!/^https:\/\//i.test(d.url)) { notes.push(`Document “${d.title}” is only available over insecure http and was not linked: ${d.url}`); files.docsFailed++; continue; }
      await sb.from("product_documents").insert({ product_id: productId, kind, title: d.title, external_url: d.url, source_url: d.url, is_public: true });
      files.docsLinked++;
    } catch (e) { notes.push(`Document “${d.title}”: ${(e as Error).message}`); files.docsFailed++; }
  }
}

/**
 * Imports approved records as unpublished, quote-only DRAFTS. Records that match an already imported product (same manufacturer
 * and source key) are never imported again: they wait as updates with a change preview (applyExtractedUpdates).
 * Website products are marked "catalogue item" (not stocked); prices and stock are never set.
 */
export async function importApproved(sourceId: string, ids: string[]): Promise<Result<ImportSummary>> {
  const user = await requireStaff(); const sb = await createClient();
  const [{ data: src }, { data: rows }, { data: cats }] = await Promise.all([
    sb.from("catalogue_sources").select("id, title, kind, settings, brand_id, brands(slug, name)").eq("id", sourceId).single(),
    sb.from("extracted_products").select("id, data, status, update_of").eq("source_id", sourceId).in("id", ids.slice(0, 200)).eq("status", "approved"),
    sb.from("categories").select("id, slug"),
  ]);
  if (!src) return fail("Catalogue not found.");
  const brand = (Array.isArray(src.brands) ? src.brands[0] : src.brands) as { slug: string; name: string } | null;
  const settings = (src.settings ?? {}) as { reuse_images?: boolean; reuse_documents?: boolean };
  const web = src.kind === "website";
  const catId = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  const imported: string[] = []; const failed: ImportSummary["failed"] = []; const cache = new Map<number, Buffer>();
  const imageKinds = { photo: 0, drawing: 0, none: 0 };   // what each imported product shows until a photo is uploaded
  const files: ImportSummary["files"] = { imagesStored: 0, imagesLinkOnly: 0, imagesFailed: 0, docsStored: 0, docsLinked: 0, docsFailed: 0 };
  let updatesWaiting = 0, duplicates = 0;
  for (const r of rows ?? []) {
    if (r.update_of) { updatesWaiting++; continue; }
    const parsed = ExtractedProductSchema.safeParse(r.data);
    if (!parsed.success) { failed.push({ id: r.id, name: "?", error: "Invalid data" }); continue; }
    const p = parsed.data;
    if (hasErrors(validateExtracted(p))) { failed.push({ id: r.id, name: p.name_en, error: "Has validation errors" }); continue; }
    // idempotency: the same page + model of this manufacturer is never imported twice
    if (p.source_key && src.brand_id) {
      const { data: prev } = await sb.rpc("products_by_source_keys", { p_brand: src.brand_id, p_keys: [p.source_key] });
      const hit = (prev as { product_id: string; name_en: string }[] | null)?.[0];
      if (hit) { await sb.from("extracted_products").update({ status: "pending", update_of: hit.product_id, duplicate_of: hit.product_id, updated_at: new Date().toISOString() }).eq("id", r.id); duplicates++; continue; }
    }
    try {
      const slug = await uniqueSlug(sb, "products", `${brand?.slug ?? slugify(p.manufacturer)}-${web && p.manufacturer_ref ? slugify(p.manufacturer_ref) : p.family.key}`);
      const code = brandCode(p.manufacturer);
      const { data: skus } = await sb.from("product_variants").select("sku").ilike("sku", `${code}-%`);
      const variants = buildVariants(p, new Set((skus ?? []).map((s) => s.sku.toLowerCase())));
      const note = (pg: number) => `${src.title}, page ${pg}`.slice(0, 300);
      const found: Omit<ImportImage, "is_primary" | "sort_order">[] = []; const reviewNotes: string[] = []; const linkOnly: string[] = [];
      for (const [n, im] of p.images.entries()) {
        if (im.url) {
          // manufacturer website image: copied only with the reuse permission recorded on the source, otherwise kept as a link for review
          if (!settings.reuse_images) { linkOnly.push(im.url); files.imagesLinkOnly++; continue; }
          try {
            const c = await storeWebImage(sb, im.url, `manufacturer/${brand?.slug ?? "brand"}/${slug}/${n + 1}-${randomUUID().slice(0, 8)}.webp`);
            found.push({ storage_path: c.path, thumb_path: c.thumb, alt_en: im.alt_en, alt_ar: im.alt_ar ?? null, needs_hires: c.small, source: "manufacturer", kind: im.kind, width: c.width, height: c.height, bytes: c.bytes, source_note: im.url.slice(0, 300) });
            files.imagesStored++;
          } catch (e) { reviewNotes.push(`Image ${im.url} could not be stored: ${(e as Error).message}`); files.imagesFailed++; }
        } else if (im.page !== undefined && im.bbox) {
          const c = await cropTo(sb, sourceId, im.page, im.bbox, `catalogue/${slug}/${n + 1}-${randomUUID().slice(0, 8)}.webp`, cache);
          found.push({ storage_path: c.path, thumb_path: c.thumb, alt_en: im.alt_en, alt_ar: im.alt_ar ?? null, needs_hires: c.small, source: "catalogue", kind: im.kind, width: c.width, height: c.height, bytes: c.bytes, source_note: note(im.page) });
        }
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
      const review = [...reviewNotes, ...(linkOnly.length ? [`${linkOnly.length} manufacturer image(s) not copied (no reuse permission recorded) — upload your own photo or confirm permission.`] : [])];
      const payload = {
        family: { slug: p.family.key, name_en: p.family.name_en, name_ar: p.family.name_ar ?? null, product_type: p.family.type ?? null, category_id: p.category_slug ? catId.get(p.category_slug) ?? null : null },
        product: {
          slug, name_en: p.name_en, name_ar: p.name_ar ?? null, ...text,
          category_id: p.category_slug ? catId.get(p.category_slug) ?? null : null, brand_id: src.brand_id, manufacturer_ref: p.manufacturer_ref ?? null, country_of_origin: p.country ?? null,
          applications_en: p.applications_en.join("\n") || null, applications_ar: null,
          specs: { standards: p.standards, materials: p.materials, notes: p.notes, ...(p.properties.length ? { properties: p.properties } : {}) },
          source_ref: web
            ? { source_id: sourceId, title: src.title, url: p.source_url, retrieved_at: p.retrieved_at, ...(linkOnly.length ? { image_urls: linkOnly } : {}), ...(review.length ? { review } : {}) }
            : { source_id: sourceId, title: src.title, pages: p.pages },
        },
        options: buildOptions(p), variants, dimension_tables: tables, images,
      };
      const { data: pid, error } = await sb.rpc("catalogue_import_product", { p_extracted: r.id, p: payload });
      if (error) throw new Error(error.message);
      if (p.source_key || web) {
        const { error: ke } = await sb.from("products").update({ source_url: p.source_url ?? null, source_key: p.source_key ?? null, catalogue_only: web }).eq("id", pid);
        if (ke) {   // the same source key was imported in the meantime: undo this draft rather than keep a duplicate
          await sb.from("products").delete().eq("id", pid);
          await sb.from("extracted_products").update({ status: "pending", imported_product_id: null }).eq("id", r.id);
          throw new Error(ke.code === "23505" ? "Already imported (same manufacturer page and model)." : ke.message);
        }
      }
      // where each image came from, its thumbnail and size (kept separately from the product, replaceable later)
      if (images.length) { const { error: ie } = await sb.rpc("catalogue_import_images", { p_product: pid, p: images }); if (ie) throw new Error(ie.message); }
      if (p.documents.length) {
        const docNotes: string[] = [];
        await attachDocuments(sb, pid as string, `manufacturer/${brand?.slug ?? "brand"}/${slug}`, p.documents, !!settings.reuse_documents, files, docNotes);
        if (docNotes.length) await sb.from("products").update({ source_ref: { ...payload.product.source_ref, review: [...review, ...docNotes] } }).eq("id", pid);
      }
      imageKinds[images[0]?.kind ?? "none"]++;
      imported.push(pid as string);
    } catch (e) { failed.push({ id: r.id, name: p.name_en, error: (e as Error).message }); }
  }
  // classify the new products' materials straight away (same rules as Admin → Materials; never touches admin decisions)
  if (imported.length) { try { const { runDetection } = await import("@/lib/materials/run"); await runDetection(sb, { dryRun: false, productIds: imported }); } catch { /* detection can be re-run from Admin → Materials */ } }
  const summary = { imported: imported.length, updatesWaiting, duplicates, failed, product_ids: imported, images: imageKinds, files };
  await sb.from("catalogue_import_runs").insert({ source_id: sourceId, created_by: user.id, summary });
  await audit(sb, user.id, "catalogue.import", "catalogue_sources", sourceId, { imported: imported.length, failed: failed.length, duplicates, updatesWaiting });
  refreshStorefront(); done(sourceId); revalidatePath("/admin/products");
  return ok({ imported: imported.length, updatesWaiting, duplicates, failed, images: imageKinds, files });
}

/**
 * Applies reviewed updates to products imported earlier from the same manufacturer page + model. Only the fields shown in the
 * change preview as "applies" are written (descriptions, model number, specification rows, standards, materials, new documents);
 * names, prices, stock, variants, images and the publication status are never touched. Admins confirm in the browser first.
 */
export async function applyExtractedUpdates(sourceId: string, ids: string[]): Promise<Result<{ updated: number; unchanged: number; failed: { name: string; error: string }[] }>> {
  const user = await requireStaff(); const sb = await createClient();
  const [{ data: src }, { data: rows }] = await Promise.all([
    sb.from("catalogue_sources").select("id, settings, brand_id, brands(slug)").eq("id", sourceId).single(),
    sb.from("extracted_products").select("id, data, update_of, status").eq("source_id", sourceId).in("id", ids.slice(0, 200)).not("update_of", "is", null),
  ]);
  if (!src) return fail("Catalogue not found.");
  const settings = (src.settings ?? {}) as { reuse_documents?: boolean }; const brandSlug = ((Array.isArray(src.brands) ? src.brands[0] : src.brands) as { slug: string } | null)?.slug ?? "brand";
  let updated = 0, unchanged = 0; const failed: { name: string; error: string }[] = [];
  const files: ImportSummary["files"] = { imagesStored: 0, imagesLinkOnly: 0, imagesFailed: 0, docsStored: 0, docsLinked: 0, docsFailed: 0 };
  for (const r of rows ?? []) {
    const parsed = ExtractedProductSchema.safeParse(r.data); if (!parsed.success) { failed.push({ name: "?", error: "Invalid data" }); continue; }
    const p = parsed.data;
    if (r.status === "imported") { unchanged++; continue; }
    if (hasErrors(validateExtracted(p))) { failed.push({ name: p.name_en, error: "Has validation errors" }); continue; }
    try {
      const { changes } = await detectDuplicate(sb, p, src.brand_id);   // recomputed now, so what is written is what is current
      const apply = (changes ?? []).filter((c) => c.applies);
      if (!apply.length) { unchanged++; await sb.from("extracted_products").update({ status: "imported", imported_product_id: r.update_of }).eq("id", r.id); continue; }
      const { data: cur } = await sb.from("products").select("slug, specs").eq("id", r.update_of!).single();
      const specs = { ...((cur?.specs ?? {}) as Record<string, unknown>) }; const patch: Record<string, unknown> = {}; const text = describe(p);
      for (const c of apply) {
        if (c.field === "description_en") patch.description_en = text.description_en;
        if (c.field === "short_desc_en") patch.short_desc_en = text.short_desc_en;
        if (c.field === "manufacturer_ref") patch.manufacturer_ref = p.manufacturer_ref ?? null;
        if (c.field === "properties") specs.properties = p.properties;
        if (c.field === "standards") specs.standards = p.standards;
        if (c.field === "materials") specs.materials = p.materials;
      }
      patch.specs = specs;
      const { error } = await sb.from("products").update(patch).eq("id", r.update_of!); if (error) throw new Error(error.message);
      if (apply.some((c) => c.field === "documents")) {
        const { data: have } = await sb.from("product_documents").select("external_url, source_url").eq("product_id", r.update_of!);
        const known = new Set((have ?? []).flatMap((d) => [d.external_url, d.source_url]).filter(Boolean));
        await attachDocuments(sb, r.update_of!, `manufacturer/${brandSlug}/${cur?.slug ?? "product"}`, p.documents.filter((d) => !known.has(d.url)), !!settings.reuse_documents, files, []);
      }
      await sb.from("extracted_products").update({ status: "imported", imported_product_id: r.update_of, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", r.id);
      await audit(sb, user.id, "catalogue.update_product", "products", r.update_of!, { source: sourceId, fields: apply.map((c) => c.field), changes: apply });
      updated++;
    } catch (e) { failed.push({ name: p.name_en, error: (e as Error).message }); }
  }
  refreshStorefront(); done(sourceId); revalidatePath("/admin/products");
  return ok({ updated, unchanged, failed });
}
