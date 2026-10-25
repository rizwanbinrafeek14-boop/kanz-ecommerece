import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ExtractedProduct, ExtractionFile } from "@/lib/catalogue/schema";

export const dynamic = "force-dynamic";
const safe = (v: unknown) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);   // CSV/XLSX formula-injection guard

/** Export a catalogue's extraction: JSON (complete, re-loadable), CSV / Excel (one row per variant, plus dimension rows in Excel). Staff only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "staff" && user.role !== "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const sb = await createClient();
  const [{ data: src }, { data: pages }, { data: items }] = await Promise.all([
    sb.from("catalogue_sources").select("title, page_count, brands(name)").eq("id", id).maybeSingle(),
    sb.from("catalogue_pages").select("page_no, status, method, skip_reason, error").eq("source_id", id).order("page_no"),
    sb.from("extracted_products").select("status, data").eq("source_id", id).order("created_at"),
  ]);
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const manufacturer = ((Array.isArray(src.brands) ? src.brands[0] : src.brands) as { name: string } | null)?.name ?? "Unknown";
  const products = (items ?? []).map((i) => i.data as ExtractedProduct);
  const stamp = `${src.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "json") {
    const file: ExtractionFile = { format: "kanz-catalogue-extraction/1", manufacturer, source_title: src.title, page_count: src.page_count ?? 1,
      pages: (pages ?? []).filter((p) => ["extracted", "needs_review", "skipped"].includes(p.status)).map((p) => ({ page: p.page_no, status: p.status as "extracted", note: p.skip_reason ?? p.error ?? null, method: (p.method ?? "manual") as "manual" })), products };
    return new NextResponse(JSON.stringify(file, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${stamp}.json"` } });
  }
  const variantRows = (items ?? []).flatMap((i) => { const p = i.data as ExtractedProduct; return (p.variants.length ? p.variants : [{ options: {} as Record<string, string>, page: p.pages[0] }]).map((v) => ({ product: p.name_en, family: p.family.key, status: i.status, ...Object.fromEntries(p.options.map((o) => [o.name_en, o.values.find((x) => x.value === v.options[o.key])?.label_en ?? ""])), manufacturer_code: "manufacturer_code" in v ? v.manufacturer_code ?? "" : "", weight_kg: "weight_kg" in v ? v.weight_kg ?? "" : "", page: v.page ?? "" })); });
  const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)])));
  if (format === "csv") return new NextResponse("﻿" + Papa.unparse(clean(variantRows)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${stamp}.csv"` } });
  const wb = new ExcelJS.Workbook();
  const add = (name: string, rows: Record<string, unknown>[]) => { const ws = wb.addWorksheet(name); const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]; ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) })); rows.forEach((r) => ws.addRow(r)); ws.getRow(1).font = { bold: true }; };
  add("Variants", clean(variantRows));
  add("Dimensions", clean(products.flatMap((p) => p.dimension_tables.flatMap((t) => t.rows.map((r) => ({ product: p.name_en, table: t.title_en, page: t.page, applies: Object.entries(t.applies).map(([k, v]) => `${k}=${v}`).join(", "), ...Object.fromEntries(Object.entries(r.match).map(([k, v]) => [`[${k}]`, v])), ...Object.fromEntries(t.columns.map((c) => [`${c.key}${c.unit ? ` (${c.unit})` : ""}`, r.values[c.key] ?? ""])) }))))));
  add("Pages", clean((pages ?? []).map((p) => ({ page: p.page_no, status: p.status, method: p.method ?? "", note: p.skip_reason ?? p.error ?? "" }))));
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${stamp}.xlsx"` } });
}
