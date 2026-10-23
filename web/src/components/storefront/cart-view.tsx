"use client";
import * as React from "react";
import Link from "next/link";
import { Trash2, ClipboardList } from "lucide-react";
import { useCart } from "./cart-provider";
import { createClient } from "@/lib/supabase/browser";
import { formatSAR, publicUrl, withVat } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

interface Live { price: number | null; available: number; ok: boolean }

/** Re-reads current prices/availability from the database so the cart never shows stale prices. The server re-prices again at checkout. */
export function useLivePrices(variantIds: string[]) {
  const [live, setLive] = React.useState<Record<string, Live>>({});
  const key = variantIds.join(",");
  React.useEffect(() => {
    if (!variantIds.length || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = createClient();
    (async () => {
      const [{ data: vs }, { data: av }] = await Promise.all([
        sb.from("product_variants").select("id, price, is_active, products(base_price, is_quote_only, status)").in("id", variantIds),
        sb.from("variant_availability").select("variant_id, available").in("variant_id", variantIds),
      ]);
      const avail = new Map((av ?? []).map((a: any) => [a.variant_id, Number(a.available)]));
      const out: Record<string, Live> = {};
      for (const v of (vs ?? []) as any[]) {
        const p = Array.isArray(v.products) ? v.products[0] : v.products;
        const price = v.price ?? p?.base_price ?? null;
        out[v.id] = { price: price == null ? null : Number(price), available: avail.get(v.id) ?? 0, ok: !!v.is_active && p?.status === "published" && !p?.is_quote_only && price != null };
      }
      setLive(out);
    })();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return live;
}

export function CartView({ lang, dict, vatRate }: { lang: Locale; dict: Dictionary; vatRate: number }) {
  const { cart, quote, setQty, remove, ready } = useCart();
  const live = useLivePrices(cart.map((l) => l.variantId!).filter(Boolean));
  if (!ready) return <p className="py-10 text-center text-muted-foreground">{dict.common.loading}</p>;

  const priced = cart.map((l) => {
    const lv = l.variantId ? live[l.variantId] : undefined;
    const price = lv ? lv.price : l.unitPrice ?? null;
    const bad = lv ? !lv.ok || lv.available < l.qty : false;
    return { l, price, bad, lv };
  });
  const subtotal = priced.reduce((n, x) => n + (x.price ?? 0) * x.l.qty, 0);
  const t = withVat(subtotal, vatRate);
  const blocked = priced.some((x) => x.bad || x.price == null);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center"><p className="text-muted-foreground">{dict.cart.empty}</p>
            <Button asChild className="mt-4"><Link href={`/${lang}/products`}>{dict.cart.continue}</Link></Button></div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {priced.map(({ l, price, bad, lv }) => (
              <li key={l.key} className="flex gap-4 p-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-white">{l.image && <img src={publicUrl("product-images", l.image)!} alt="" className="size-full object-contain p-1" />}</div>
                <div className="min-w-0 flex-1">
                  <Link href={`/${lang}/product/${l.slug}`} className="font-semibold hover:text-primary">{l.name}</Link>
                  <p className="text-xs text-muted-foreground">{[l.sku, l.spec].filter(Boolean).join(" · ")}</p>
                  {bad && <p className="mt-1 text-sm font-medium text-destructive">{lv && lv.available < l.qty ? `${dict.common.outOfStock} (${lv.available})` : dict.common.outOfStock}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <Input type="number" min={0.01} step="any" value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))} className="h-9 w-24" aria-label={dict.common.quantity} />
                    <button onClick={() => remove(l.key)} className="text-muted-foreground hover:text-destructive" aria-label={dict.common.remove}><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <p className="text-end font-semibold">{price != null ? formatSAR(price * l.qty, lang) : "—"}<span className="block text-xs font-normal text-muted-foreground">{dict.common.exVat}</span></p>
              </li>
            ))}
          </ul>
        )}
        {quote.length > 0 && (
          <Link href={`/${lang}/rfq`} className="mt-6 flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm hover:border-primary">
            <ClipboardList className="size-5 text-primary" /><span><strong>{quote.length}</strong> — {dict.cart.quoteList}. {dict.cart.sendRfq} →</span>
          </Link>
        )}
      </div>
      {cart.length > 0 && (
        <aside className="h-fit space-y-3 rounded-xl border bg-card p-5">
          <div className="flex justify-between text-sm"><span>{dict.common.subtotal}</span><span>{formatSAR(t.subtotal, lang)}</span></div>
          <div className="flex justify-between text-sm"><span>{dict.common.vat} ({vatRate}%)</span><span>{formatSAR(t.vat, lang)}</span></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>{dict.common.total}</span><span>{formatSAR(t.total, lang)}</span></div>
          <p className="text-xs text-muted-foreground">{dict.cart.freight}</p>
          <Button asChild size="lg" className="w-full" aria-disabled={blocked}><Link href={blocked ? "#" : `/${lang}/checkout`}>{dict.cart.checkout}</Link></Button>
        </aside>
      )}
    </div>
  );
}
