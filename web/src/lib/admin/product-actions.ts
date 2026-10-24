"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, uniqueSlug, type Result } from "./common";
import { slugify } from "@/lib/utils";

const money = z.number().min(0).max(100_000_000).nullable();
const generalSchema = z.object({
  name_en: z.string().trim().min(2, "English name is required").max(250), name_ar: z.string().trim().max(250).nullable(),
  slug: z.string().trim().max(120).nullable(), sku: z.string().trim().max(80).nullable(), barcode: z.string().trim().max(80).nullable(),
  category_id: z.string().uuid().nullable(), brand_id: z.string().uuid().nullable(), status: z.enum(["draft", "published", "archived"]),
  is_featured: z.boolean(), is_new_arrival: z.boolean(), is_special_offer: z.boolean(), offer_label_en: z.string().trim().max(60).nullable(), offer_label_ar: z.string().trim().max(60).nullable(),
  unit: z.string().trim().min(1).max(20), min_order_qty: z.number().positive().max(1_000_000),
  short_desc_en: z.string().trim().max(500).nullable(), short_desc_ar: z.string().trim().max(500).nullable(),
  description_en: z.string().trim().max(10000).nullable(), description_ar: z.string().trim().max(10000).nullable(),
  seo_title_en: z.string().trim().max(120).nullable(), seo_title_ar: z.string().trim().max(120).nullable(), seo_desc_en: z.string().trim().max(300).nullable(), seo_desc_ar: z.string().trim().max(300).nullable(),
});
export type ProductGeneralInput = z.input<typeof generalSchema>;

export async function saveProductGeneral(id: string | null, input: ProductGeneralInput): Promise<Result<{ id: string; slug: string }>> {
  const user = await requireStaff();
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const d = parsed.data;
  const sb = await createClient();
  if (d.sku) {
    const { data: used } = await sb.rpc("sku_in_use", { p_sku: d.sku, p_exclude_product: id });
    if (used) return fail(`SKU “${d.sku}” is already used by another product or variant.`);
  }
  const slug = await uniqueSlug(sb, "products", d.slug ? slugify(d.slug) : d.name_en, id ?? undefined);
  if (id) {
    const { error } = await sb.from("products").update({ ...d, slug }).eq("id", id);
    if (error) return fail(error.message);
    await audit(sb, user.id, "product.update", "products", id);
    refreshStorefront(); revalidatePath("/admin/products");
    return ok({ id, slug });
  }
  const { data, error } = await sb.from("products").insert({ ...d, slug, is_quote_only: true }).select("id").single();
  if (error || !data) return fail(error?.message ?? "Could not create product");
  await audit(sb, user.id, "product.create", "products", data.id);
  revalidatePath("/admin/products");
  return ok({ id: data.id, slug });
}

const pricingSchema = z.object({ is_quote_only: z.boolean(), base_price: money, compare_at_price: money, purchase_cost: money });
export async function saveProductPricing(id: string, input: z.input<typeof pricingSchema>): Promise<Result> {
  const user = await requireStaff();
  const parsed = pricingSchema.safeParse(input);
  if (!parsed.success) return fail("Prices must be zero or more.");
  const { purchase_cost, ...rest } = parsed.data;
  if (!rest.is_quote_only && rest.base_price == null) {
    const sb0 = await createClient();
    const { count } = await sb0.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", id).eq("is_active", true).not("price", "is", null);
    if (!count) return fail("Set a selling price (or add priced variants) before turning off “quote only”. Prices are never invented.");
  }
  const sb = await createClient();
  const { error } = await sb.from("products").update(rest).eq("id", id);
  if (error) return fail(error.message);
  if (purchase_cost == null) await sb.from("product_costs").delete().eq("product_id", id);
  else await sb.from("product_costs").upsert({ product_id: id, purchase_cost });
  await audit(sb, user.id, "product.pricing", "products", id, rest);
  refreshStorefront(); revalidatePath(`/admin/products/${id}`);
  return ok(null);
}

export async function setProductsStatus(ids: string[], status: "draft" | "published" | "archived"): Promise<Result<{ changed: number }>> {
  const user = await requireStaff();
  if (!ids.length) return fail("Select at least one product.");
  const sb = await createClient();
  const { data, error } = await sb.from("products").update({ status }).in("id", ids).select("id");
  if (error) return fail(error.message);
  await audit(sb, user.id, `product.status.${status}`, "products", undefined, { ids });
  refreshStorefront(); revalidatePath("/admin/products");
  return ok({ changed: data?.length ?? 0 });
}

export async function deleteProducts(ids: string[]): Promise<Result<{ deleted: number }>> {
  const user = await requireStaff();
  const sb = await createClient();
  let deleted = 0;
  for (const id of ids) {
    const { data: imgs } = await sb.from("product_images").select("storage_path").eq("product_id", id);
    const { count, error } = await sb.from("products").delete({ count: "exact" }).eq("id", id);
    if (error) return fail(error.code === "23503" ? "This product has orders and cannot be deleted. Archive it instead." : error.message);
    if (!count) return fail("Only administrators can delete published or archived products. Archive it instead, or ask an admin.");
    if (imgs?.length) await sb.storage.from("product-images").remove(imgs.map((i) => i.storage_path));
    deleted++;
  }
  await audit(sb, user.id, "product.delete", "products", undefined, { ids });
  refreshStorefront(); revalidatePath("/admin/products");
  return ok({ deleted });
}

// ───────── Bulk price update ─────────
const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5000), mode: z.enum(["percent", "amount", "set"]), value: z.number().min(-100_000_000).max(100_000_000),
  target: z.enum(["products", "variants", "both"]), round: z.boolean(),
});
export async function bulkUpdatePrices(input: z.input<typeof bulkSchema>): Promise<Result<{ updated: number; skipped: number }>> {
  const user = await requireStaff();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid value.");
  const { ids, mode, value, target, round } = parsed.data;
  if (mode === "percent" && value <= -100) return fail("A decrease of 100% or more would make prices zero or negative.");
  const sb = await createClient();
  const calc = (old: number | null) => {
    if (mode === "set") return value < 0 ? null : value;
    if (old == null) return null;             // never invent a price where none exists
    const n = mode === "percent" ? old * (1 + value / 100) : old + value;
    if (n < 0) return null;
    return Math.round((round ? Math.round(n) : n) * 100) / 100;
  };
  let updated = 0, skipped = 0;
  if (target !== "variants") {
    const { data } = await sb.from("products").select("id, base_price").in("id", ids);
    for (const r of data ?? []) {
      const np = calc(r.base_price == null ? null : Number(r.base_price));
      if (np == null) { skipped++; continue; }
      const { error } = await sb.from("products").update({ base_price: np }).eq("id", r.id); if (!error) updated++;
    }
  }
  if (target !== "products") {
    const { data } = await sb.from("product_variants").select("id, price").in("product_id", ids);
    for (const r of data ?? []) {
      const np = calc(r.price == null ? null : Number(r.price));
      if (np == null) { skipped++; continue; }
      const { error } = await sb.from("product_variants").update({ price: np }).eq("id", r.id); if (!error) updated++;
    }
  }
  await audit(sb, user.id, "product.bulk_price", "products", undefined, { mode, value, target, count: ids.length, updated });
  refreshStorefront(); revalidatePath("/admin/products");
  return ok({ updated, skipped });
}

// ───────── Variants ─────────
const variantSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(80), barcode: z.string().trim().max(80).nullable(), label_en: z.string().trim().max(150).nullable(), label_ar: z.string().trim().max(150).nullable(),
  size: z.string().trim().max(60).nullable(), grade: z.string().trim().max(60).nullable(), schedule: z.string().trim().max(60).nullable(), pressure_class: z.string().trim().max(60).nullable(), material: z.string().trim().max(80).nullable(),
  price: money, purchase_cost: money, is_active: z.boolean(),
});
export async function saveVariant(productId: string, variantId: string | null, input: z.input<typeof variantSchema>): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the variant.");
  const { purchase_cost, ...v } = parsed.data;
  const sb = await createClient();
  const { data: dup } = await sb.rpc("sku_in_use", { p_sku: v.sku, p_exclude_variant: variantId });
  if (dup) return fail(`SKU “${v.sku}” is already in use.`);
  let id = variantId;
  if (id) {
    const { error } = await sb.from("product_variants").update(v).eq("id", id);
    if (error) return fail(error.message.includes("variants_barcode_uq") ? "That barcode is already used by another variant." : error.message);
  } else {
    const { data, error } = await sb.from("product_variants").insert({ ...v, product_id: productId }).select("id").single();
    if (error || !data) return fail(error?.message.includes("variants_barcode_uq") ? "That barcode is already used by another variant." : error?.message ?? "Could not add variant");
    id = data.id;
  }
  if (purchase_cost == null) await sb.from("variant_costs").delete().eq("variant_id", id!);
  else await sb.from("variant_costs").upsert({ variant_id: id!, purchase_cost });
  await audit(sb, user.id, variantId ? "variant.update" : "variant.create", "product_variants", id!);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok({ id: id! });
}
export async function deleteVariant(productId: string, variantId: string): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { error } = await sb.from("product_variants").delete().eq("id", variantId);
  if (error) return fail(error.code === "23503" ? "This variant has stock history or orders. Deactivate it instead." : error.message);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}

// ───────── Attributes ─────────
export async function saveProductAttributes(productId: string, values: Record<string, { en: string[]; ar: string[] }>): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { data: defs } = await sb.from("attribute_defs").select("id, key");
  const id = new Map((defs ?? []).map((d) => [d.key, d.id]));
  const rows = Object.entries(values).flatMap(([k, v]) => {
    const attribute_id = id.get(k); if (!attribute_id) return [];
    const seen = new Set<string>();
    return v.en.map((en, i) => ({ en: en.trim(), ar: (v.ar[i] ?? "").trim() || null, i })).filter((x) => x.en && !seen.has(x.en) && seen.add(x.en))
      .map((x) => ({ product_id: productId, attribute_id, value_en: x.en.slice(0, 200), value_ar: x.ar?.slice(0, 200) ?? null, sort_order: x.i }));
  });
  const del = await sb.from("product_attribute_values").delete().eq("product_id", productId);
  if (del.error) return fail(del.error.message);
  if (rows.length) { const { error } = await sb.from("product_attribute_values").insert(rows); if (error) return fail(error.message); }
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}

// ───────── Images ─────────
export async function addProductImages(productId: string, paths: string[]): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { data: ex } = await sb.from("product_images").select("sort_order, is_primary").eq("product_id", productId);
  let next = Math.max(-1, ...(ex ?? []).map((e) => e.sort_order)) + 1; let hasPrimary = (ex ?? []).some((e) => e.is_primary);
  const rows = paths.map((storage_path) => { const r = { product_id: productId, storage_path, sort_order: next++, is_primary: !hasPrimary, needs_hires: false }; hasPrimary = true; return r; });
  const { error } = await sb.from("product_images").insert(rows);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}
export async function setPrimaryImage(productId: string, imageId: string): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  await sb.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error } = await sb.from("product_images").update({ is_primary: true }).eq("id", imageId);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}
export async function updateImageMeta(productId: string, imageId: string, patch: { needs_hires?: boolean; alt_en?: string | null; alt_ar?: string | null; sort_order?: number }): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { error } = await sb.from("product_images").update(patch).eq("id", imageId);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}
/** Replace an image file (e.g. with a high-resolution original) while keeping its position and primary flag. */
export async function replaceImageFile(productId: string, imageId: string, newPath: string): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { data: old } = await sb.from("product_images").select("storage_path").eq("id", imageId).single();
  const { error } = await sb.from("product_images").update({ storage_path: newPath, needs_hires: false }).eq("id", imageId);
  if (error) return fail(error.message);
  if (old?.storage_path) await sb.storage.from("product-images").remove([old.storage_path]);
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}
export async function deleteImage(productId: string, imageId: string): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { data: img } = await sb.from("product_images").select("storage_path, is_primary").eq("id", imageId).single();
  const { error } = await sb.from("product_images").delete().eq("id", imageId);
  if (error) return fail(error.message);
  if (img) await sb.storage.from("product-images").remove([img.storage_path]);
  if (img?.is_primary) {
    const { data: first } = await sb.from("product_images").select("id").eq("product_id", productId).order("sort_order").limit(1);
    if (first?.[0]) await sb.from("product_images").update({ is_primary: true }).eq("id", first[0].id);
  }
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}

// ───────── Documents (datasheets, MTCs) ─────────
export async function addProductDocument(productId: string, input: { kind: "datasheet" | "mtc" | "certificate" | "other"; title: string; path: string; is_public: boolean }): Promise<Result> {
  await requireStaff();
  const parsed = z.object({ kind: z.enum(["datasheet", "mtc", "certificate", "other"]), title: z.string().trim().min(1).max(150), path: z.string().min(1).max(300), is_public: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("Give the document a title.");
  const sb = await createClient();
  const { error } = await sb.from("product_documents").insert({ product_id: productId, kind: parsed.data.kind, title: parsed.data.title, storage_path: parsed.data.path, is_public: parsed.data.is_public });
  if (error) return fail(error.message);
  revalidatePath(`/admin/products/${productId}`); refreshStorefront();
  return ok(null);
}
export async function deleteProductDocument(productId: string, docId: string, bucket: string, path: string): Promise<Result> {
  await requireStaff();
  const sb = await createClient();
  const { error } = await sb.from("product_documents").delete().eq("id", docId);
  if (error) return fail(error.message);
  // A file can be shared by several products (e.g. an MTC bundle): only delete it when nothing else points at it.
  const { count } = await sb.from("product_documents").select("id", { count: "exact", head: true }).eq("storage_path", path);
  if (!count) await sb.storage.from(bucket === "product-mtc" ? "product-mtc" : "product-docs").remove([path]);
  revalidatePath(`/admin/products/${productId}`); refreshStorefront();
  return ok(null);
}

// ───────── Related / alternatives ─────────
export async function setProductRelations(productId: string, relation: "related" | "alternative", relatedIds: string[]): Promise<Result> {
  await requireStaff();
  const ids = [...new Set(relatedIds)].filter((x) => x !== productId).slice(0, 24);
  const sb = await createClient();
  await sb.from("product_relations").delete().eq("product_id", productId).eq("relation", relation);
  if (ids.length) { const { error } = await sb.from("product_relations").insert(ids.map((related_id, i) => ({ product_id: productId, related_id, relation, sort_order: i }))); if (error) return fail(error.message); }
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`);
  return ok(null);
}
