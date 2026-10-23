"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { useLivePrices } from "./cart-view";
import { placeOrderAction } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { formatSAR, withVat } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export function CheckoutForm({ lang, dict, vatRate, defaults }: { lang: Locale; dict: Dictionary; vatRate: number; defaults: { name: string; phone: string } }) {
  const router = useRouter();
  const { cart, clear, ready } = useCart();
  const live = useLivePrices(cart.map((l) => l.variantId!).filter(Boolean));
  const [delivery, setDelivery] = React.useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = React.useState<"bank_transfer" | "cod">("bank_transfer");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!ready) return null;
  if (!cart.length) return <p className="text-muted-foreground">{dict.cart.empty} <Link className="font-semibold text-primary" href={`/${lang}/products`}>{dict.cart.continue}</Link></p>;

  const priceOf = (l: (typeof cart)[number]) => (l.variantId ? live[l.variantId]?.price : undefined) ?? l.unitPrice ?? 0;
  const subtotal = cart.reduce((n, l) => n + priceOf(l) * l.qty, 0);
  const t = withVat(subtotal, vatRate);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "");
    const res = await placeOrderAction({
      items: cart.map((l) => ({ variant_id: l.variantId!, quantity: l.qty })), delivery, payment, notes: g("notes") || undefined,
      address: delivery === "delivery" ? { recipient: g("recipient"), phone: g("phone"), line1: g("line1"), line2: g("line2") || undefined, city: g("city"), region: g("region") || undefined, postal_code: g("postal_code") || undefined } : undefined,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    clear("cart");
    router.push(`/${lang}/account/orders/${res.data.id}?placed=1`);
  }

  const radio = (name: string, value: string, label: string, checked: boolean, onChange: () => void, disabled = false) => (
    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${checked ? "border-primary bg-primary/5" : ""} ${disabled ? "opacity-50" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="accent-[var(--primary)]" />{label}
    </label>
  );
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-semibold">{dict.checkout.delivery}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {radio("d", "delivery", dict.checkout.deliver, delivery === "delivery", () => setDelivery("delivery"))}
            {radio("d", "pickup", dict.checkout.pickup, delivery === "pickup", () => setDelivery("pickup"))}
          </div>
        </section>
        {delivery === "delivery" && (
          <section className="space-y-3">
            <h2 className="font-semibold">{dict.checkout.address}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="recipient">{dict.checkout.recipient}</Label><Input id="recipient" name="recipient" required defaultValue={defaults.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">{dict.account.phone}</Label><Input id="phone" name="phone" required defaultValue={defaults.phone} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="line1">{dict.checkout.line1}</Label><Input id="line1" name="line1" required /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="line2">{dict.checkout.line2}</Label><Input id="line2" name="line2" /></div>
              <div className="space-y-1.5"><Label htmlFor="city">{dict.rfq.city}</Label><Input id="city" name="city" required /></div>
              <div className="space-y-1.5"><Label htmlFor="region">{dict.checkout.region}</Label><Input id="region" name="region" /></div>
              <div className="space-y-1.5"><Label htmlFor="postal_code">{dict.checkout.postal}</Label><Input id="postal_code" name="postal_code" /></div>
            </div>
          </section>
        )}
        <section className="space-y-3">
          <h2 className="font-semibold">{dict.checkout.payment}</h2>
          <div className="grid gap-2">
            {radio("p", "bank_transfer", dict.checkout.bankTransfer, payment === "bank_transfer", () => setPayment("bank_transfer"))}
            {radio("p", "cod", dict.checkout.cod, payment === "cod", () => setPayment("cod"))}
            {radio("p", "online", dict.checkout.onlineSoon, false, () => {}, true)}
          </div>
        </section>
        <div className="space-y-1.5"><Label htmlFor="notes">{dict.checkout.notes}</Label><Textarea id="notes" name="notes" /></div>
      </div>
      <aside className="h-fit space-y-3 rounded-xl border bg-card p-5">
        <ul className="space-y-2 text-sm">{cart.map((l) => <li key={l.key} className="flex justify-between gap-3"><span className="truncate">{l.name} × {l.qty}</span><span>{formatSAR(priceOf(l) * l.qty, lang)}</span></li>)}</ul>
        <div className="flex justify-between border-t pt-3 text-sm"><span>{dict.common.subtotal}</span><span>{formatSAR(t.subtotal, lang)}</span></div>
        <div className="flex justify-between text-sm"><span>{dict.common.vat} ({vatRate}%)</span><span>{formatSAR(t.vat, lang)}</span></div>
        <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>{dict.common.total}</span><span>{formatSAR(t.total, lang)}</span></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button size="lg" className="w-full" disabled={busy}>{busy ? dict.common.loading : dict.checkout.place}</Button>
        <p className="text-xs text-muted-foreground">{dict.cart.freight}</p>
      </aside>
    </form>
  );
}
