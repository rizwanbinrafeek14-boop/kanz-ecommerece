"use server";
/**
 * Product images (stored separately from the product: table product_images, bucket product-images).
 * Uploading, replacing or restoring an image never touches the product, its variants, stock, brand or family data.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";
import { PLACEHOLDER_KINDS } from "@/lib/images/placeholder";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = z.string().uuid();
const fileSchema = z.object({
  path: z.string().min(3).max(300), thumb: z.string().min(3).max(300).nullable(),
  width: z.number().int().min(0).max(20000).nullable(), height: z.number().int().min(0).max(20000).nullable(), bytes: z.number().int().min(0).max(50_000_000).nullable(),
  original_name: z.string().max(200).nullable(), small: z.boolean().default(false), kind: z.enum(["photo", "drawing"]).default("photo"),
});
export type UploadedFile = z.input<typeof fileSchema>;
const inFolder = (productId: string, f: { path: string; thumb: string | null }) => f.path.startsWith(`${productId}/`) && (!f.thumb || f.thumb.startsWith(`${productId}/`));

function refresh(productId: string) { refreshStorefront(); revalidatePath(`/admin/products/${productId}`); revalidatePath("/admin/products"); revalidatePath("/admin/products/images"); }

/** Deletes storage files only when no image, drawing, family or social image refers to them any more. */
async function removeUnused(sb: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))]; if (!list.length) return;
  const { data } = await sb.rpc("unreferenced_image_paths", { p_paths: list });
  const drop = (data as string[] | null) ?? [];
  if (drop.length) await sb.storage.from("product-images").remove(drop);
}

/** Adds an uploaded photo. `main`: it becomes the main image (shown on listings, search, the quote list and first on the product page). */
export async function addProductPhoto(productId: string, file: UploadedFile, opts: { main: boolean; optionMatch?: Record<string, string> | null }): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const f = fileSchema.safeParse(file); if (!uuid.safeParse(productId).success || !f.success) return fail("Invalid image data.");
  if (!inFolder(productId, f.data)) return fail("The file was not uploaded to this product's folder.");
  const sb = await createClient();
  const { data: ex } = await sb.from("product_images").select("id, sort_order, is_primary").eq("product_id", productId);
  const main = opts.main || !(ex ?? []).some((e) => e.is_primary);
  if (main && ex?.length) await sb.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { data, error } = await sb.from("product_images").insert({
    product_id: productId, storage_path: f.data.path, thumb_path: f.data.thumb, width: f.data.width, height: f.data.height, bytes: f.data.bytes,
    original_name: f.data.original_name, needs_hires: f.data.small, kind: f.data.kind, source: "upload", is_primary: main,
    sort_order: main ? Math.min(0, ...(ex ?? []).map((e) => e.sort_order)) - 1 : Math.max(-1, ...(ex ?? []).map((e) => e.sort_order)) + 1,
    option_match: opts.optionMatch && Object.keys(opts.optionMatch).length ? opts.optionMatch : null,
  }).select("id").single();
  if (error) return fail(error.message);
  await audit(sb, user.id, "product.image_add", "products", productId, { image: data.id, main, file: f.data.original_name });
  refresh(productId); return ok({ id: data.id });
}

/** Replaces the file of an image; the image keeps its place, main flag, alt text and "shown for options". The old file is kept for undo. */
export async function replaceProductImage(productId: string, imageId: string, file: UploadedFile): Promise<Result> {
  const user = await requireStaff();
  const f = fileSchema.safeParse(file); if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success || !f.success) return fail("Invalid image data.");
  if (!inFolder(productId, f.data)) return fail("The file was not uploaded to this product's folder.");
  const sb = await createClient();
  const { data: own } = await sb.from("product_images").select("id").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!own) return fail("Image not found for this product.");
  const { data: drop, error } = await sb.rpc("replace_product_image", { p_image: imageId, p_path: f.data.path, p_thumb: f.data.thumb,
    p_meta: { width: f.data.width, height: f.data.height, bytes: f.data.bytes, original_name: f.data.original_name, needs_hires: f.data.small, kind: f.data.kind } });
  if (error) return fail(error.message);
  const paths = (drop as string[] | null) ?? [];
  if (paths.length) await sb.storage.from("product-images").remove(paths);   // already checked as unused by the database
  await audit(sb, user.id, "product.image_replace", "products", productId, { image: imageId, file: f.data.original_name });
  refresh(productId); return ok(null);
}

/**
 * "Upload / Replace product image": replaces the main image when there is one (keeping its row), otherwise adds the photo as the main image.
 * When the main image is limited to some options, the new photo is added as a general main image instead.
 */
export async function setMainPhoto(productId: string, file: UploadedFile): Promise<Result<{ replaced: boolean }>> {
  await requireStaff();
  if (!uuid.safeParse(productId).success) return fail("Invalid product.");
  const sb = await createClient();
  const { data: main } = await sb.from("product_images").select("id, option_match").eq("product_id", productId).eq("is_primary", true).maybeSingle();
  if (main && !main.option_match) { const r = await replaceProductImage(productId, main.id, file); return r.ok ? ok({ replaced: true }) : r; }
  const r = await addProductPhoto(productId, file, { main: true }); return r.ok ? ok({ replaced: false }) : r;
}

export async function restoreProductImage(productId: string, imageId: string): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: own } = await sb.from("product_images").select("id").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!own) return fail("Image not found for this product.");
  const { error } = await sb.rpc("restore_product_image", { p_image: imageId }); if (error) return fail(error.message);
  await audit(sb, user.id, "product.image_restore", "products", productId, { image: imageId });
  refresh(productId); return ok(null);
}

export async function deleteProductImage(productId: string, imageId: string): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: img } = await sb.from("product_images").select("storage_path, thumb_path, previous_path, previous_thumb_path, is_primary").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!img) return fail("Image not found for this product.");
  const { error } = await sb.from("product_images").delete().eq("id", imageId); if (error) return fail(error.message);
  // the social image falls back to the main image when its file goes away
  await sb.from("products").update({ og_image_path: null }).eq("id", productId).eq("og_image_path", img.storage_path);
  if (img.is_primary) {
    const { data: next } = await sb.from("product_images").select("id").eq("product_id", productId).order("option_match", { nullsFirst: true }).order("sort_order").limit(1);
    if (next?.[0]) await sb.from("product_images").update({ is_primary: true }).eq("id", next[0].id);
  }
  await removeUnused(sb, [img.storage_path, img.thumb_path, img.previous_path, img.previous_thumb_path]);   // shared catalogue drawings stay
  await audit(sb, user.id, "product.image_delete", "products", productId, { image: imageId });
  refresh(productId); return ok(null);
}

/** The placeholder drawing shown while the product has no image (null = automatic from name / category). */
export async function setPlaceholderKind(productId: string, kind: string | null): Promise<Result> {
  await requireStaff();
  if (kind !== null && !(PLACEHOLDER_KINDS as readonly string[]).includes(kind)) return fail("Unknown placeholder.");
  const sb = await createClient();
  const { error } = await sb.from("products").update({ placeholder_kind: kind }).eq("id", productId); if (error) return fail(error.message);
  refresh(productId); return ok(null);
}

// ───────── Bulk upload ─────────
export interface FileMatch { name: string; product_id: string; product_name: string; product_sku: string | null; product_status: string; matched_by: string; matched_value: string; exact: boolean; variant_id: string | null; variant_options: Record<string, string> | null;
  has_main: boolean; image_status: string }

/** Matches file names to products by SKU, variant SKU, manufacturer code / reference, slug or product name. */
export async function matchImageFiles(names: string[]): Promise<Result<FileMatch[]>> {
  await requireStaff();
  const list = z.array(z.string().max(300)).max(1000).safeParse(names); if (!list.success) return fail("Up to 1,000 files at a time.");
  const sb = await createClient();
  const { data, error } = await sb.rpc("match_image_files", { p_names: list.data });
  if (error) return fail(error.message);
  const rows = (data ?? []) as Omit<FileMatch, "has_main" | "image_status">[];
  const ids = [...new Set(rows.map((r) => r.product_id))];
  const info = new Map<string, { has_main: boolean; image_status: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ps } = await sb.from("products").select("id, image_status, product_images(is_primary, option_match)").in("id", ids.slice(i, i + 200));
    for (const p of ps ?? []) info.set(p.id, { image_status: p.image_status, has_main: !!p.product_images?.some((x) => x.is_primary && !x.option_match) });
  }
  return ok(rows.map((r) => ({ ...r, ...(info.get(r.product_id) ?? { has_main: false, image_status: "none" }) })));
}

export interface ProductPick { id: string; name_en: string; sku: string | null; status: string; image_count: number; has_main: boolean; image_status: string }
/** Product search for assigning a file by hand (name, SKU or slug). */
export async function findProductsForImage(q: string): Promise<Result<ProductPick[]>> {
  await requireStaff();
  const term = q.trim().replace(/[%_,()]/g, " ").slice(0, 80); if (term.length < 2) return ok([]);
  const sb = await createClient();
  const { data, error } = await sb.from("products").select("id, name_en, sku, status, image_status, product_images(id, is_primary, option_match)")
    .or(`name_en.ilike.%${term}%,sku.ilike.%${term}%,slug.ilike.%${term}%`).order("name_en").limit(12);
  if (error) return fail(error.message);
  return ok((data ?? []).map((p) => ({ id: p.id, name_en: p.name_en, sku: p.sku, status: p.status, image_count: p.product_images?.length ?? 0, has_main: !!p.product_images?.some((i) => i.is_primary && !i.option_match), image_status: p.image_status })));
}
