"use client";
import * as React from "react";
import Link from "next/link";
import { MessageCircle, ShoppingCart, ClipboardPlus, Check, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./cart-provider";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Label } from "@/components/ui/input";
import { formatSAR, withVat } from "@/lib/format";
import { track } from "@/lib/track";
import { setSelectedVariant } from "@/lib/variant-store";
import { ApprovalBadgeRow, type ApprovalLabels } from "./approvals";
import { OptionSelector, settle, type SelOption } from "./option-selector";
import type { Approval } from "@/lib/queries/certs";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface BuyVariant { id: string; sku: string; label: string; spec: string; price: number | null; available: number; options?: Record<string, string> }
export interface BuyProps {
  product: { id: string; slug: string; name: string; unit: string; quoteOnly: boolean; basePrice: number | null; minQty: number; image: string | null };
  variants: BuyVariant[]; options?: SelOption[]; datasheet?: string; approvals: Approval[]; approvalLabels: ApprovalLabels; vatRate: number; whatsapp: string; waGreeting: string; lang: Locale; dict: Dictionary; url: string;
}

export function BuyBox({ product, variants, options = [], datasheet, approvals, approvalLabels, vatRate, whatsapp, waGreeting, lang, dict, url }: BuyProps) {
  const { add } = useCart();
  const [vid, setVid] = React.useState(variants[0]?.id ?? "");
  const optVariants = React.useMemo(() => variants.filter((x) => x.options && Object.keys(x.options).length).map((x) => ({ id: x.id, options: x.options! })), [variants]);
  const [sel, setSel] = React.useState<Record<string, string>>(() => (options.length && optVariants[0] ? settle(options, optVariants, optVariants[0].options) : {}));
  const pick = (next: Record<string, string>) => { setSel(next); const m = optVariants.find((x) => options.every((o) => x.options[o.key] === next[o.key])); if (m) setVid(m.id); };
  const [qty, setQty] = React.useState(Math.max(1, product.minQty));
  const [justAdded, setJustAdded] = React.useState<"cart" | "quote" | null>(null);
  const v = variants.find((x) => x.id === vid);
  React.useEffect(() => { setSelectedVariant(v?.id ?? null); return () => setSelectedVariant(null); }, [v?.id]);
  const price = product.quoteOnly ? null : (v?.price ?? product.basePrice);
  const stock = v ? v.available : null;
  const canBuy = !product.quoteOnly && !!v && price != null && (stock ?? 0) >= qty;
  const t = price != null ? withVat(price * qty, vatRate) : null;

  const flash = (k: "cart" | "quote") => { setJustAdded(k); setTimeout(() => setJustAdded(null), 1600); };
  const base = { productId: product.id, slug: product.slug, name: product.name, image: product.image, unit: product.unit, qty };
  const waLines = [`${waGreeting}`.trim(), `${dict.product.waProduct}: ${product.name}`, v?.sku && `${dict.product.waSku}: ${v.sku}`, v?.spec && `${dict.product.waVariant}: ${v.spec}`, `${dict.product.waQty}: ${qty} ${product.unit}`, `${dict.product.waLink}: ${url}`].filter(Boolean);
  const wa = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waLines.join("\n"))}`;
  const addQuote = () => { add({ ...base, kind: "quote", variantId: v?.id, sku: v?.sku, spec: v?.spec }); flash("quote"); toast.success(`${dict.product.added}: ${product.name}`); };
  const addCart = () => { add({ ...base, kind: "cart", variantId: v!.id, sku: v!.sku, spec: v!.spec, unitPrice: price }); flash("cart"); toast.success(`${dict.product.added}: ${product.name}`); };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      {options.length > 0 && optVariants.length > 0 ? (
        <OptionSelector options={options} variants={optVariants} value={sel} onChange={pick} unavailableLabel={lang === "ar" ? "غير متوفر بهذه التركيبة" : "Not offered in this combination"} />
      ) : variants.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="variant">{dict.product.variants}</Label>
          <NativeSelect id="variant" value={vid} onChange={(e) => setVid(e.target.value)}>
            {variants.map((x) => <option key={x.id} value={x.id}>{x.label || x.spec || x.sku} — {x.sku}</option>)}
          </NativeSelect>
        </div>
      )}

      <div>
        {price != null ? (
          <>
            <p className="text-3xl font-extrabold">{formatSAR(price, lang)} <span className="text-sm font-normal text-muted-foreground">/ {product.unit} · {dict.common.exVat}</span></p>
            <p className="text-sm text-muted-foreground">{formatSAR(withVat(price, vatRate).total, lang)} {dict.common.incVat} ({vatRate}% {dict.common.vat})</p>
          </>
        ) : <p className="text-xl font-bold">{dict.product.priceOnRequest}</p>}
        <p className={`mt-2 text-sm font-medium ${!product.quoteOnly && stock && stock > 0 ? "text-success" : "text-muted-foreground"}`}>
          {!product.quoteOnly && stock && stock > 0 ? dict.common.stockConfirmed.replace("{n}", new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US").format(stock)) : dict.common.onRequest}
        </p>
        {product.quoteOnly && <p className="mt-1 text-sm text-muted-foreground">{dict.product.familyNote}</p>}
      </div>

      <div className="flex items-end gap-3">
        <div className="w-28 space-y-1.5">
          <Label htmlFor="qty">{dict.common.quantity}</Label>
          <Input id="qty" type="number" min={product.minQty} step="any" value={qty} onChange={(e) => setQty(Math.max(product.minQty, Number(e.target.value) || 1))} />
        </div>
        {t && <p className="pb-2 text-sm text-muted-foreground">{dict.common.total}: <strong className="text-foreground">{formatSAR(t.total, lang)}</strong> {dict.common.incVat}</p>}
      </div>
      {product.minQty > 1 && <p className="-mt-3 text-xs text-muted-foreground">{dict.product.minOrder}: {product.minQty} {product.unit}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {!product.quoteOnly && (
          <Button size="lg" disabled={!canBuy} onClick={addCart}>
            {justAdded === "cart" ? <Check className="size-5" /> : <ShoppingCart className="size-5" />} {dict.product.addToCart}
          </Button>
        )}
        <Button size="lg" variant={product.quoteOnly ? "default" : "outline"} className={product.quoteOnly ? "sm:col-span-2" : ""} onClick={addQuote}>
          {justAdded === "quote" ? <Check className="size-5" /> : <ClipboardPlus className="size-5" />} {product.quoteOnly ? dict.product.requestQuote : dict.product.addToQuote}
        </Button>
      </div>
      {justAdded === "quote" && <Link href={`/${lang}/rfq`} className="block text-center text-sm font-medium text-primary hover:underline">{dict.cart.sendRfq} →</Link>}

      {datasheet && <a href={`${datasheet}?lang=${lang}${v ? `&variant=${v.id}` : ""}`} rel="noopener noreferrer nofollow" target="_blank" onClick={() => track("datasheet_download", { product: product.id })} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-steel-300 text-sm font-semibold hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <FileDown className="size-4" aria-hidden="true" />{lang === "ar" ? "تحميل ورقة البيانات (PDF)" : "Download datasheet (PDF)"}{v ? <span className="font-mono text-xs text-muted-foreground">{v.sku}</span> : null}</a>}
      {datasheet && <p className="-mt-1 text-center text-xs text-muted-foreground">{dict.account.signInToDownload}</p>}
      <ApprovalBadgeRow approvals={approvals} lang={lang} labels={approvalLabels} className="pt-1" />

      {whatsapp && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { product: product.id })}
          className="flex items-center justify-center gap-2 rounded-md border border-[#128C4A] py-3 text-sm font-semibold text-[#0b6b38] hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MessageCircle className="size-5" /> {dict.product.whatsappInquiry}
        </a>
      )}
      {/* Sticky enquiry bar for phones/tablets (the floating contact button lifts above it) */}
      <div data-sticky-bar className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-[0_-4px_16px_rgba(0,0,0,.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1 text-xs"><p className="truncate font-semibold">{product.name}</p><p className="truncate text-muted-foreground">{price != null ? formatSAR(price, lang) : dict.product.priceOnRequest}</p></div>
          {whatsapp && <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click", { product: product.id })} aria-label={dict.product.whatsappInquiry} className="flex size-12 shrink-0 items-center justify-center rounded-md border border-[#128C4A] text-[#0b6b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle className="size-6" /></a>}
          {!product.quoteOnly && canBuy ? <Button size="lg" className="h-12 shrink-0" onClick={addCart}><ShoppingCart className="size-5" />{dict.product.addToCart}</Button>
            : <Button size="lg" className="h-12 shrink-0" onClick={addQuote}><ClipboardPlus className="size-5" />{product.quoteOnly ? dict.product.requestQuote : dict.product.addToQuote}</Button>}
        </div>
      </div>
    </div>
  );
}
