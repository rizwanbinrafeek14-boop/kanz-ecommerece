import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OPEN, ageHours, rfqListQuery, staffList } from "@/lib/admin/rfq-list";

export const dynamic = "force-dynamic";
// CSV/XLSX injection guard: cells starting with = + - @ are treated as formulas by Excel (customers type these fields).
const safe = (v: unknown) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const riyadh = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Riyadh" }).slice(0, 16) : null);
const MAX = 5000;

/** The admin quotation list as Excel or CSV, with the same filters as the list page (staff only). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "staff" && user.role !== "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = new URL(req.url).searchParams; const f = Object.fromEntries(["q", "status", "owner", "age", "sort"].map((k) => [k, p.get(k) ?? undefined]));
  const sb = await createClient();
  const [{ data, count }, staff] = await Promise.all([
    rfqListQuery(sb, f, user.id, "rfq_number, created_at, status, assigned_to, assigned_at, contact_name, company_name, contact_email, contact_phone, delivery_city, required_by, quoted_total, quoted_at, quote_valid_until, rfq_items(count)").range(0, MAX - 1),
    staffList(sb),
  ]);
  const names = new Map(staff.map((s) => [s.id, s.name])); const now = Date.now();
  const rows = (data ?? []).map((r: any) => Object.fromEntries(Object.entries({
    number: r.rfq_number, received: riyadh(r.created_at), status: r.status,
    waiting_hours: (OPEN as readonly string[]).includes(r.status) ? Math.floor(ageHours(r.created_at, now)) : null,
    owner: r.assigned_to ? names.get(r.assigned_to) ?? "former staff member" : null, assigned: riyadh(r.assigned_at),
    customer: r.contact_name, company: r.company_name, email: r.contact_email, phone: r.contact_phone, city: r.delivery_city, required_by: r.required_by,
    lines: r.rfq_items?.[0]?.count ?? 0, quoted_total_sar: r.quoted_total == null ? null : Number(r.quoted_total), quoted: riyadh(r.quoted_at), valid_until: r.quote_valid_until,
  }).map(([k, v]) => [k, safe(v)])));
  const stamp = new Date().toISOString().slice(0, 10); const name = `kanz-quotation-requests-${stamp}`;
  const note = (count ?? 0) > MAX ? `Only the first ${MAX} of ${count} requests are included; narrow the filters.` : null;
  if (p.get("format") === "csv") {
    return new NextResponse("﻿" + Papa.unparse(rows.length ? rows : [{ number: "" }]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, ...(note ? { "x-export-note": note } : {}) } });
  }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Quotation requests");
  const cols = Object.keys(rows[0] ?? { number: 1, received: 1, status: 1, waiting_hours: 1, owner: 1, assigned: 1, customer: 1, company: 1, email: 1, phone: 1, city: 1, required_by: 1, lines: 1, quoted_total_sar: 1, quoted: 1, valid_until: 1 });
  ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) })); ws.addRows(rows);
  ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }]; ws.getColumn("quoted_total_sar").numFmt = "#,##0.00";
  if (note) wb.addWorksheet("Note").addRow([note]);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` } });
}
