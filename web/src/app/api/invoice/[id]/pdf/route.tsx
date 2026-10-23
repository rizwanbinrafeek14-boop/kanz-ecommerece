import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { InvoicePdf } from "@/lib/pdf/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RLS decides access: only the order's owner or staff can read the invoice row.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const sb = await createClient();
  const { data: invoice } = await sb.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  const [{ data: order }, { data: items }] = await Promise.all([sb.from("orders").select("*").eq("id", invoice.order_id).single(), sb.from("order_items").select("*").eq("order_id", invoice.order_id).order("id")]);
  const buf = await renderToBuffer(<InvoicePdf invoice={invoice} order={order!} items={items ?? []} />);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${invoice.invoice_number}.pdf"`, "cache-control": "private, no-store" } });
}
