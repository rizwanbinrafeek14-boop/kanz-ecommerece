import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteActions } from "@/components/storefront/quote-actions";

export const metadata = { title: "Quotation", robots: { index: false, follow: false } };

export default async function RfqViewPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang, token } = await params;
  if (!isLocale(lang) || !/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const dict = getDictionary(lang);
  const sb = await createClient();
  const { data } = await sb.rpc("get_rfq_by_token", { p_token: token });
  if (!data) notFound();
  const { rfq, items } = data as { rfq: Record<string, any>; items: Record<string, any>[] };
  const quoted = rfq.quoted_at != null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">{dict.rfq.title}</p><h1 className="font-mono text-2xl font-bold" dir="ltr">{rfq.rfq_number}</h1></div>
        <Badge variant={rfq.status === "quoted" ? "info" : rfq.status === "accepted" ? "success" : "secondary"}>{dict.status[rfq.status as keyof typeof dict.status] ?? rfq.status}</Badge>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">{dict.rfq.description}</th><th className="p-3 text-end">{dict.common.quantity}</th>{quoted && <><th className="p-3 text-end">{dict.common.price}</th><th className="p-3 text-end">{dict.common.total}</th></>}</tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id} className="border-t"><td className="p-3">{i.line_no}</td>
              <td className="p-3"><p className="font-medium">{i.description}</p>{i.specification && <p className="text-xs text-muted-foreground">{i.specification}</p>}</td>
              <td className="p-3 text-end">{i.quantity} {i.unit}</td>
              {quoted && <><td className="p-3 text-end">{i.quoted_unit_price != null ? formatSAR(i.quoted_unit_price, lang) : "—"}</td><td className="p-3 text-end">{i.quoted_unit_price != null ? formatSAR(i.quoted_unit_price * i.quantity, lang) : "—"}</td></>}
            </tr>))}</tbody>
        </table>
      </div>
      {quoted && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <dl className="space-y-1.5 text-sm">
            {rfq.quote_valid_until && <div className="flex gap-2"><dt className="font-semibold">Valid until:</dt><dd>{formatDate(rfq.quote_valid_until, lang)}</dd></div>}
            {rfq.lead_time && <div className="flex gap-2"><dt className="font-semibold">Lead time:</dt><dd>{rfq.lead_time}</dd></div>}
            {rfq.payment_terms && <div className="flex gap-2"><dt className="font-semibold">Payment terms:</dt><dd>{rfq.payment_terms}</dd></div>}
            {rfq.delivery_terms && <div className="flex gap-2"><dt className="font-semibold">Delivery:</dt><dd>{rfq.delivery_terms}</dd></div>}
            {rfq.quote_notes && <p className="pt-2 text-muted-foreground">{rfq.quote_notes}</p>}
          </dl>
          <div className="space-y-1 rounded-xl border bg-card p-4 text-sm">
            <div className="flex justify-between"><span>{dict.common.subtotal}</span><span>{formatSAR(rfq.quoted_subtotal, lang)}</span></div>
            <div className="flex justify-between"><span>{dict.common.vat} ({rfq.vat_rate}%)</span><span>{formatSAR(rfq.quoted_vat, lang)}</span></div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>{dict.common.total}</span><span>{formatSAR(rfq.quoted_total, lang)}</span></div>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {quoted && <Button asChild variant="outline"><a href={`/api/rfq/${token}/pdf`}><Download className="size-4" />PDF</a></Button>}
        {rfq.status === "quoted" && <QuoteActions token={token} labels={{ accept: lang === "ar" ? "قبول عرض السعر" : "Accept quotation", decline: lang === "ar" ? "رفض" : "Decline" }} />}
      </div>
      {!quoted && <p className="mt-6 text-sm text-muted-foreground">{dict.rfq.successText}</p>}
    </div>
  );
}
