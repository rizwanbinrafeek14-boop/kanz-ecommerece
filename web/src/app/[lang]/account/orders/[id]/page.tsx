import { notFound } from "next/navigation";
import { CheckCircle2, Download } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Order", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ lang: string; id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { lang, id } = await params; const { placed } = await searchParams;
  if (!isLocale(lang) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireCustomer(lang);
  const dict = getDictionary(lang);
  const sb = await createClient();
  const { data: o } = await sb.from("orders").select("*, order_items(*), order_status_history(*), shipments(*), invoices(id, invoice_number)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!o) notFound();
  const st = (k: string) => dict.status[k as keyof typeof dict.status] ?? k;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {placed && <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-900"><CheckCircle2 className="size-6" /><div><p className="font-semibold">{dict.checkout.success}</p><p className="text-sm">{dict.checkout.orderNo}: <span className="font-mono" dir="ltr">{o.order_number}</span></p></div></div>}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-mono text-2xl font-bold" dir="ltr">{o.order_number}</h1><p className="text-sm text-muted-foreground">{formatDate(o.created_at, lang)}</p></div>
        <div className="flex gap-2"><Badge variant="secondary">{st(o.status)}</Badge><Badge variant={o.payment_status === "paid" ? "success" : "warning"}>{st(o.payment_status)}</Badge></div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">{dict.rfq.description}</th><th className="p-3 text-end">{dict.common.quantity}</th><th className="p-3 text-end">{dict.common.price}</th><th className="p-3 text-end">{dict.common.total}</th></tr></thead>
          <tbody>{o.order_items.map((i: any) => (
            <tr key={i.id} className="border-t"><td className="p-3"><p className="font-medium">{lang === "ar" && i.name_ar ? i.name_ar : i.name_en}</p><p className="text-xs text-muted-foreground">{[i.sku, i.spec_summary].filter(Boolean).join(" · ")}</p></td>
              <td className="p-3 text-end">{i.quantity}</td><td className="p-3 text-end">{formatSAR(i.unit_price, lang)}</td><td className="p-3 text-end">{formatSAR(i.line_total, lang)}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="ms-auto mt-4 w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span>{dict.common.subtotal}</span><span>{formatSAR(o.subtotal, lang)}</span></div>
        {Number(o.shipping_total) > 0 && <div className="flex justify-between"><span>Shipping</span><span>{formatSAR(o.shipping_total, lang)}</span></div>}
        <div className="flex justify-between"><span>{dict.common.vat} ({o.vat_rate}%)</span><span>{formatSAR(o.vat_total, lang)}</span></div>
        <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>{dict.common.total}</span><span>{formatSAR(o.grand_total, lang)}</span></div>
      </div>
      {o.invoices?.length > 0 && <Button asChild variant="outline" className="mt-4"><a href={`/api/invoice/${o.invoices[0].id}/pdf`}><Download className="size-4" />{dict.account.invoice} {o.invoices[0].invoice_number}</a></Button>}
      {o.shipments?.length > 0 && (
        <section className="mt-8"><h2 className="mb-2 font-semibold">Delivery tracking</h2>
          {o.shipments.map((s: any) => <p key={s.id} className="text-sm">{s.carrier ?? "—"} {s.tracking_number && <>· <span className="font-mono">{s.tracking_number}</span></>} · <Badge variant="info">{s.status}</Badge> {s.tracking_url && <a className="ms-2 text-primary underline" href={s.tracking_url} target="_blank" rel="noopener noreferrer">Track</a>}</p>)}
        </section>
      )}
      <section className="mt-8"><h2 className="mb-2 font-semibold">{dict.account.status}</h2>
        <ol className="space-y-1 border-s ps-4 text-sm">{[...o.order_status_history].sort((a: any, b: any) => b.id - a.id).map((h: any) => <li key={h.id}><span className="font-medium">{st(h.status)}</span> <span className="text-muted-foreground">· {formatDateTime(h.created_at)}{h.note ? ` · ${h.note}` : ""}</span></li>)}</ol>
      </section>
    </div>
  );
}
