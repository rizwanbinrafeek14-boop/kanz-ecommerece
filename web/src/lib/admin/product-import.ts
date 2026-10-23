"use server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, uniqueSlug, type Result } from "./common";
import { revalidatePath } from "next/cache";

export interface ImportRow {
  line: number; slug: string | null; sku: string | null; name_en: string; name_ar: string | null; category_slug: string | null; brand: string | null; status: "draft" | "published" | "archived";
  base_price: number | null; purchase_cost: number | null; unit: string; min_order_qty: number; is_quote_only: boolean; short_desc_en: string | null; description_en: string | null;
  action: "create" | "update" | "error"; problems: string[];
}
export interface VariantImportRow { line: number; product_slug: string; sku: string; size: string | null; grade: string | null; schedule: string | null; pressure_class: string | null; price: number | null; purchase_cost: number | null; barcode: string | null; problems: string[]; action: "create" | "update" | "error" }

const norm = (k: string) => k.trim().toLowerCase().replace(/[\s-]+/g, "_");
const str = (v: unknown) => { const s = v == null ? "" : String(typeof v === "object" && v && "text" in (v as object) ? (v as { text: string }).text : v).trim(); return s === "" ? null : s; };
const numv = (v: unknown) => { const s = str(v); if (s == null) return null; const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? n : NaN; };
const boolv = (v: unknown, d: boolean) => { const s = str(v)?.toLowerCase(); return s == null ? d : ["1", "true", "yes", "y"].includes(s); };

async function readSheets(file: File): Promise<{ products: Record<string, unknown>[]; variants: Record<string, unknown>[] }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const toObjs = (rows: unknown[][]) => { const [h, ...rest] = rows; const keys = (h ?? []).map((x) => norm(String(x ?? ""))); return rest.filter((r) => r.some((c) => str(c) != null)).map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]))); };
  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse<unknown[]>(buf.toString("utf8").replace(/^﻿/, ""), { skipEmptyLines: true });
    return { products: toObjs(parsed.data), variants: [] };
  }
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheet = (name: string, idx: number) => { const ws = wb.getWorksheet(name) ?? (idx === 0 ? wb.worksheets[0] : undefined); if (!ws) return []; const rows: unknown[][] = []; ws.eachRow({ includeEmpty: false }, (r) => rows.push((r.values as unknown[]).slice(1))); return toObjs(rows); };
  return { products: sheet("Products", 0), variants: sheet("Variants", 1) };
}

export async function previewProductImport(fd: FormData): Promise<Result<{ products: ImportRow[]; variants: VariantImportRow[] }>> {
  await requireStaff();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return fail("Choose a CSV or Excel (.xlsx) file.");
  if (file.size > 8 * 1024 * 1024) return fail("File is larger than 8 MB.");
  if (!/\.(csv|xlsx)$/i.test(file.name)) return fail("Only .csv and .xlsx files are supported.");
  let sheets; try { sheets = await readSheets(file); } catch { return fail("Could not read the file. Is it a valid .csv/.xlsx?"); }
  if (sheets.products.length > 5000) return fail("Too many rows (max 5000 per import).");

  const sb = await createClient();
  const [{ data: cats }, { data: prods }, { data: vars }] = await Promise.all([
    sb.from("categories").select("slug"), sb.from("products").select("id, slug, sku"), sb.from("product_variants").select("id, sku, product_id"),
  ]);
  const catSet = new Set((cats ?? []).map((c) => c.slug));
  const bySlug = new Map((prods ?? []).map((p) => [p.slug, p])); const bySku = new Map((prods ?? []).filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
  const variantSku = new Map((vars ?? []).map((v) => [v.sku.toLowerCase(), v]));
  const seenSku = new Map<string, number>();

  const products: ImportRow[] = sheets.products.map((r, i) => {
    const problems: string[] = [];
    const name_en = str(r.name_en ?? r.name) ?? ""; if (!name_en) problems.push("name_en is required");
    const sku = str(r.sku); const slug = str(r.slug);
    const status = (str(r.status) ?? "draft").toLowerCase(); if (!["draft", "published", "archived"].includes(status)) problems.push(`invalid status “${status}”`);
    const bp = numv(r.base_price ?? r.price), pc = numv(r.purchase_cost), mq = numv(r.min_order_qty) ?? 1;
    if (Number.isNaN(bp) || (bp != null && bp < 0)) problems.push("invalid base_price"); if (Number.isNaN(pc) || (pc != null && pc < 0)) problems.push("invalid purchase_cost"); if (Number.isNaN(mq) || mq <= 0) problems.push("invalid min_order_qty");
    const cs = str(r.category_slug ?? r.category); if (cs && !catSet.has(cs)) problems.push(`unknown category “${cs}”`);
    const existing = (slug && bySlug.get(slug)) || (sku && bySku.get(sku.toLowerCase())) || null;
    if (sku) {
      const k = sku.toLowerCase();
      if (seenSku.has(k)) problems.push(`duplicate SKU in file (also line ${seenSku.get(k)})`); else seenSku.set(k, i + 2);
      if (variantSku.has(k)) problems.push("SKU already used by a variant");
      const owner = bySku.get(k); if (owner && existing && owner.id !== existing.id) problems.push("SKU belongs to a different product");
    }
    const quote = boolv(r.is_quote_only, bp == null);
    if (status === "published" && !quote && bp == null) problems.push("not quote-only but no base_price");
    return { line: i + 2, slug, sku, name_en, name_ar: str(r.name_ar), category_slug: cs, brand: str(r.brand), status: status as ImportRow["status"], base_price: Number.isNaN(bp) ? null : bp, purchase_cost: Number.isNaN(pc) ? null : pc,
      unit: str(r.unit) ?? "pcs", min_order_qty: Number.isNaN(mq) ? 1 : mq, is_quote_only: quote, short_desc_en: str(r.short_desc_en), description_en: str(r.description_en), problems, action: problems.length ? "error" : existing ? "update" : "create" };
  });

  const slugsInFile = new Set(products.map((p) => p.slug).filter(Boolean) as string[]);
  const variants: VariantImportRow[] = sheets.variants.map((r, i) => {
    const problems: string[] = []; const product_slug = str(r.product_slug) ?? ""; const sku = str(r.sku) ?? "";
    if (!sku) problems.push("sku is required"); if (!product_slug) problems.push("product_slug is required");
    else if (!bySlug.has(product_slug) && !slugsInFile.has(product_slug)) problems.push(`unknown product_slug “${product_slug}”`);
    const price = numv(r.price), cost = numv(r.purchase_cost); if (Number.isNaN(price) || (price != null && price < 0)) problems.push("invalid price"); if (Number.isNaN(cost)) problems.push("invalid purchase_cost");
    const k = sku.toLowerCase(); const exV = variantSku.get(k); const exP = bySku.get(k);
    if (exP) problems.push("SKU already used by a product");
    if (exV && bySlug.get(product_slug) && exV.product_id !== bySlug.get(product_slug)!.id) problems.push("SKU belongs to a different product");
    if (sku && seenSku.has(k)) problems.push("duplicate SKU in file"); else if (sku) seenSku.set(k, -1);
    return { line: i + 2, product_slug, sku, size: str(r.size), grade: str(r.grade), schedule: str(r.schedule), pressure_class: str(r.pressure_class), price: Number.isNaN(price) ? null : price, purchase_cost: Number.isNaN(cost) ? null : cost, barcode: str(r.barcode), problems, action: problems.length ? "error" : exV ? "update" : "create" };
  });
  return ok({ products, variants });
}

const rowSchema = z.object({ slug: z.string().nullable(), sku: z.string().nullable(), name_en: z.string().min(1), name_ar: z.string().nullable(), category_slug: z.string().nullable(), brand: z.string().nullable(), status: z.enum(["draft", "published", "archived"]),
  base_price: z.number().min(0).nullable(), purchase_cost: z.number().min(0).nullable(), unit: z.string().min(1).max(20), min_order_qty: z.number().positive(), is_quote_only: z.boolean(), short_desc_en: z.string().nullable(), description_en: z.string().nullable() });
const variantSchema = z.object({ product_slug: z.string().min(1), sku: z.string().min(1), size: z.string().nullable(), grade: z.string().nullable(), schedule: z.string().nullable(), pressure_class: z.string().nullable(), price: z.number().min(0).nullable(), purchase_cost: z.number().min(0).nullable(), barcode: z.string().nullable() });

async function findProduct(sb: Awaited<ReturnType<typeof createClient>>, slug: string | null, sku: string | null) {
  if (slug) { const { data } = await sb.from("products").select("id").eq("slug", slug).maybeSingle(); if (data) return data; }
  if (sku) { const { data } = await sb.from("products").select("id").ilike("sku", sku.replace(/[\\%_]/g, "\\$&")).maybeSingle(); if (data) return data; }
  return null;
}

/** Re-validates on the server (the preview is not trusted), then upserts the rows that were error-free. */
export async function applyProductImport(input: { products: ImportRow[]; variants: VariantImportRow[] }): Promise<Result<{ created: number; updated: number; variants: number; skipped: number }>> {
  const user = await requireStaff();
  const sb = await createClient();
  const [{ data: cats }, { data: brands }] = await Promise.all([sb.from("categories").select("id, slug"), sb.from("brands").select("id, name")]);
  const catId = new Map((cats ?? []).map((c) => [c.slug, c.id])); const brandId = new Map((brands ?? []).map((b) => [b.name.toLowerCase(), b.id]));
  let created = 0, updated = 0, nv = 0, skipped = 0;
  for (const raw of input.products.filter((p) => p.action !== "error").slice(0, 5000)) {
    const parsed = rowSchema.safeParse(raw); if (!parsed.success) { skipped++; continue; }
    const r = parsed.data;
    if (r.sku) { const { data: used } = await sb.rpc("sku_in_use", { p_sku: r.sku }); const ex = await findProduct(sb, r.slug, r.sku); if (used && !ex) { skipped++; continue; } }
    let bid = r.brand ? brandId.get(r.brand.toLowerCase()) ?? null : null;
    if (r.brand && !bid) { const slug = await uniqueSlug(sb, "brands", r.brand); const { data: nb } = await sb.from("brands").insert({ name: r.brand, slug }).select("id").single(); bid = nb?.id ?? null; if (bid) brandId.set(r.brand.toLowerCase(), bid); }
    const fields = { name_en: r.name_en, name_ar: r.name_ar, sku: r.sku, category_id: r.category_slug ? catId.get(r.category_slug) ?? null : null, brand_id: bid, status: r.status, base_price: r.base_price, unit: r.unit, min_order_qty: r.min_order_qty, is_quote_only: r.is_quote_only || r.base_price == null, short_desc_en: r.short_desc_en, description_en: r.description_en };
    const ex = await findProduct(sb, r.slug, r.sku);
    let pid = ex?.id;
    if (pid) { const { error } = await sb.from("products").update(fields).eq("id", pid); if (error) { skipped++; continue; } updated++; }
    else { const slug = await uniqueSlug(sb, "products", r.slug ?? r.name_en); const { data, error } = await sb.from("products").insert({ ...fields, slug }).select("id").single(); if (error || !data) { skipped++; continue; } pid = data.id; created++; }
    if (r.purchase_cost != null) await sb.from("product_costs").upsert({ product_id: pid!, purchase_cost: r.purchase_cost });
  }
  for (const raw of input.variants.filter((v) => v.action !== "error")) {
    const parsed = variantSchema.safeParse(raw); if (!parsed.success) { skipped++; continue; }
    const v = parsed.data;
    const { data: p } = await sb.from("products").select("id").eq("slug", v.product_slug).maybeSingle(); if (!p) { skipped++; continue; }
    const { data: ex } = await sb.from("product_variants").select("id").ilike("sku", v.sku.replace(/[%_]/g, "\\$&")).maybeSingle();
    const fields = { product_id: p.id, sku: v.sku, size: v.size, grade: v.grade, schedule: v.schedule, pressure_class: v.pressure_class, price: v.price, barcode: v.barcode };
    let vid = ex?.id;
    if (vid) { const { error } = await sb.from("product_variants").update(fields).eq("id", vid); if (error) { skipped++; continue; } }
    else { const { data, error } = await sb.from("product_variants").insert(fields).select("id").single(); if (error || !data) { skipped++; continue; } vid = data.id; }
    if (v.purchase_cost != null) await sb.from("variant_costs").upsert({ variant_id: vid!, purchase_cost: v.purchase_cost });
    nv++;
  }
  await audit(sb, user.id, "product.import_file", "products", undefined, { created, updated, variants: nv, skipped });
  refreshStorefront(); revalidatePath("/admin/products");
  return ok({ created, updated, variants: nv, skipped });
}
