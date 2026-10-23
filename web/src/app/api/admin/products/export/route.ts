import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// CSV/XLSX injection guard: cells starting with = + - @ are treated as formulas by Excel.
const safe = (v: unknown) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "staff" && user.role !== "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const sb = await createClient();
  const [{ data: prods }, { data: vars }, { data: costs }, { data: vcosts }] = await Promise.all([
    sb.from("products").select("slug, sku, barcode, name_en, name_ar, status, base_price, unit, min_order_qty, is_quote_only, is_featured, short_desc_en, description_en, categories(slug), brands(name), id").order("name_en").limit(20000),
    sb.from("product_variants").select("id, sku, barcode, size, grade, schedule, pressure_class, price, products(slug)").order("sku").limit(50000),
    sb.from("product_costs").select("product_id, purchase_cost"), sb.from("variant_costs").select("variant_id, purchase_cost"),
  ]);
  const cost = new Map((costs ?? []).map((c) => [c.product_id, c.purchase_cost])); const vcost = new Map((vcosts ?? []).map((c) => [c.variant_id, c.purchase_cost]));
  const pr = (prods ?? []).map((p: any) => ({ slug: p.slug, sku: p.sku, name_en: p.name_en, name_ar: p.name_ar, category_slug: p.categories?.slug ?? null, brand: p.brands?.name ?? null, status: p.status, base_price: p.base_price, purchase_cost: cost.get(p.id) ?? null, unit: p.unit, min_order_qty: p.min_order_qty, is_quote_only: p.is_quote_only ? "yes" : "no", short_desc_en: p.short_desc_en, description_en: p.description_en }));
  const vr = (vars ?? []).map((v: any) => ({ product_slug: v.products?.slug, sku: v.sku, size: v.size, grade: v.grade, schedule: v.schedule, pressure_class: v.pressure_class, price: v.price, purchase_cost: vcost.get(v.id) ?? null, barcode: v.barcode }));
  const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)])));
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return new NextResponse("﻿" + Papa.unparse(clean(pr)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="kanz-products-${stamp}.csv"` } });
  }
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of [["Products", clean(pr)], ["Variants", clean(vr)]] as const) {
    const ws = wb.addWorksheet(name); const cols = Object.keys(rows[0] ?? (name === "Products" ? { slug: 1, sku: 1, name_en: 1, name_ar: 1, category_slug: 1, brand: 1, status: 1, base_price: 1, purchase_cost: 1, unit: 1, min_order_qty: 1, is_quote_only: 1, short_desc_en: 1, description_en: 1 } : { product_slug: 1, sku: 1, size: 1, grade: 1, schedule: 1, pressure_class: 1, price: 1, purchase_cost: 1, barcode: 1 }));
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) })); ws.addRows(rows); ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="kanz-products-${stamp}.xlsx"` } });
}
