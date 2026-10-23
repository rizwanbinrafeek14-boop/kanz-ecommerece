import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireCustomer(lang);
  const dict = getDictionary(lang);
  const sb = await createClient();
  const { data: orders } = await sb.from("orders").select("id, order_number, status, payment_status, grand_total, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{dict.nav.myOrders}</h1>
      {!orders?.length ? <p className="text-muted-foreground">{dict.account.noOrders}</p> : (
        <ul className="divide-y rounded-xl border">
          {orders.map((o) => (
            <li key={o.id}><Link href={`/${lang}/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40">
              <div><p className="font-mono font-semibold" dir="ltr">{o.order_number}</p><p className="text-sm text-muted-foreground">{formatDate(o.created_at, lang)}</p></div>
              <div className="flex items-center gap-2"><Badge variant="secondary">{dict.status[o.status as keyof typeof dict.status]}</Badge><Badge variant={o.payment_status === "paid" ? "success" : "warning"}>{dict.status[o.payment_status as keyof typeof dict.status]}</Badge></div>
              <p className="font-semibold">{formatSAR(o.grand_total, lang)}</p>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
