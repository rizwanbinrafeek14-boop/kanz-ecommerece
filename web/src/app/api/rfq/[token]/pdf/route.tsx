import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getSettings, s } from "@/lib/settings";
import { QuotationPdf } from "@/lib/pdf/quotation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse("Not found", { status: 404 });
  const sb = await createClient();
  const { data } = await sb.rpc("get_rfq_by_token", { p_token: token });
  const d = data as { rfq: Record<string, any>; items: Record<string, any>[] } | null;
  if (!d || d.rfq.quoted_at == null) return new NextResponse("Quotation not ready", { status: 404 });
  const st = await getSettings();
  const buf = await renderToBuffer(<QuotationPdf rfq={d.rfq} items={d.items} company={{ name: s(st, "company_name_en", "KANZ CORNER EST."), address: s(st, "company_address_en"), phone: s(st, "company_phone"), email: s(st, "company_email_sales"), vat: s(st, "vat_number"), cr: s(st, "company_cr_number") }} />);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${d.rfq.rfq_number}.pdf"`, "cache-control": "private, no-store" } });
}
