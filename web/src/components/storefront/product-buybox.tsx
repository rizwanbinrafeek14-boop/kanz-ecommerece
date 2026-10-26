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

export interface BuyVariant { id: string; sku: string; label: string; spec: string; price: number | null; available: number; options?: Record<string, string>; material?: string | null }
/** A shown (verified / auto-detected) material of this product, with the exact grades its manufacturer lists. */
export interface MatOpt { code: string; name: string; grades: string[] }
export interface BuyProps {
  product: { id: string; slug: string; name: string; unit: string; quoteOnly: boolean; basePrice: number | null; minQty: number; image: string | null };
  variants: BuyVariant[]; options?: SelOption[]; datasheet?: string; approvals: Approval[];
  /** Family pages: start from a carried-over selection and report every change (to keep compatible choices when the brand changes). */
  initialSel?: Record<string, string>; onSelChange?: (sel: Record<string, string>, variantId: string | null) => void; brandName?: string; afterOptions?: React.ReactNode;
  /** Materials: shown as the first selector (or controlled by the family page, which shows Material above the brands). A variant with its own material only matches that material. */
  materials?: MatOpt[]; material?: string | null; onMaterialChange?: (code: string | null) => void; materialControlled?: boolean;
  approvalLabels: ApprovalLabels; vatRate: number; whatsapp: string; waGreeting: string; lang: Locale; dict: Dictionary; url: string;
}

export function BuyBox({ product, variants: allVariants, options = [], datasheet, approvals, approvalLabels, vatRate, whatsapp, waGreeting, lang, dict, url, initialSel, onSelChange, brandName, afterOptions, materials = [], material: matProp, onMaterialChange, materialControlled }: BuyProps) {
  const { add } = useCart(); const ar = lang === "ar";
  const [matOwn, setMatOwn] = React.useState<string | null>(() => matProp ?? null);
  const material = materialControlled ? (matProp ?? null) : matOwn;
  const mat = materials.find((m) => m.code === material) ?? null;
  // the grade belongs to the material it was chosen for; another material starts without a grade
  const [gradeSel, setGradeSel] = React.useState<{ m: string | null; g: string }>({ m: null, g: "" });
  const grade = gradeSel.m === material ? gradeSel.g : ""; const setGrade = (g: string) => setGradeSel({ m: material, g });
  const setMaterial = (c: string | null) => {
    if (!materialControlled) { setMatOwn(c); const u = new URL(window.location.href); if (c) u.searchParams.set("material", c); else u.searchParams.delete("material"); window.history.replaceState(null, "", u); }
    onMaterialChange?.(c);
  };
  // ?material=SS (from a filtered listing) preselects the material after the first paint
  const fromUrl = React.useCallback(() => { const m = new URLSearchParams(window.location.search).get("material")?.toUpperCase(); if (m && materials.some((x) => x.code === m)) setMatOwn(m); }, [materials]);
  React.useEffect(() => { if (materialControlled) return; const t = setTimeout(fromUrl, 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // only variants that are made in the chosen material (a variant without its own material carries all of the product's materials)
  const variants = React.useMemo(() => (material ? allVariants.filter((x) => !x.material || x.material === material) : allVariants), [allVariants, material]);
  const optVariants = React.useMemo(() => variants.filter((x) => x.options && Object.keys(x.options).length).map((x) => ({ id: x.id, options: x.options! })), [variants]);
  const match = (next: Record<string, string>) => optVariants.find((x) => options.every((o) => x.options[o.key] === next[o.key]));
  const [sel, setSel] = React.useState<Record<string, string>>(() => (options.length && optVariants[0] ? settle(options, optVariants, initialSel ?? optVariants[0].options) : {}));
  const [vid, setVid] = React.useState(() => match(sel)?.id ?? variants[0]?.id ?? "");
  const pick = (next: Record<string, string>) => { setSel(next); const m = match(next); if (m) setVid(m.id); };
  // a new material can rule out the current combination: settle it again on the remaining variants
  const [seen, setSeen] = React.useState(variants);
  if (seen !== variants) {   // adjusted during render (React's pattern for state derived from a changed prop)
    setSeen(variants);
    if (!options.length || !optVariants.length) { if (!variants.some((x) => x.id === vid)) setVid(variants[0]?.id ?? ""); }
    else { const next = settle(options, optVariants, sel); if (JSON.stringify(next) !== JSON.stringify(sel) || !match(next)) pick(next); }
  }
  React.useEffect(() => { onSelChange?.(sel, vid || null); }, [sel, vid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [qty, setQty] = React.useState(Math.max(1, product.minQty));
  const [justAdded, setJustAdded] = React.useState<"cart" | "quote" | null>(null);
  const v = variants.find((x) => x.id === vid);
  React.useEffect(() => { setSelectedVariant(v?.id ?? null); return () => setSelectedVariant(null); }, [v?.id]);
  const price = product.quoteOnly ? null : (v?.price ?? product.basePrice);
  const stock = v ? v.available : null;
  const canBuy = !product.quoteOnly && !!v && price != null && (stock ?? 0) >= qty;
  const t = price != null ? withVat(price * qty, vatRate) : null;

  const matSpec = mat ? [`${mat.name} (${mat.code})`, grade && `${ar ? "الدرجة" : "Grade"} ${grade}`].filter(Boolean).join(" · ") : "";
  const fullSpec = [v?.spec, matSpec].filter(Boolean).join(" · ") || undefined;
  const lineMat = mat ? `${mat.code}${grade ? `/${grade}` : ""}` : undefined;
  const flash = (k: "cart" | "quote") => { setJustAdded(k); setTimeout(() => setJustAdded(null), 1600); };
  const base = { productId: product.id, slug: product.slug, name: product.name, image: product.image, unit: product.unit, qty };
  const waLines = [`${waGreeting}`.trim(), `${dict.product.waProduct}: ${product.name}`, brandName && `${dict.common.brand}: ${brandName}`, v?.sku && `${dict.product.waSku}: ${v.sku}`, fullSpec && `${dict.product.waVariant}: ${fullSpec}`, `${dict.product.waQty}: ${qty} ${product.unit}`, `${dict.product.waLink}: ${url}`].filter(Boolean);
  const wa = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waLines.join("\n"))}`;
  const addQuote = () => { add({ ...base, kind: "quote", variantId: v?.id, sku: v?.sku, spec: fullSpec, material: lineMat }); flash("quote"); toast.success(`${dict.product.added}: ${product.name}`); };
  const addCart = () => { add({ ...base, kind: "cart", variantId: v!.id, sku: v!.sku, spec: fullSpec, material: lineMat, unitPrice: price }); flash("cart"); toast.success(`${dict.product.added}: ${product.name}`); };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      {!materialControlled && materials.length > 0 && <MaterialChips materials={materials} value={material} onChange={setMaterial} lang={lang} />}
      {mat && mat.grades.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="grade">{ar ? "درجة المادة" : "Material grade"}</Label>
          <NativeSelect id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">{ar ? "أي درجة مذكورة - تُؤكد في عرض السعر" : "Any listed grade - confirm in the quotation"}</option>
            {mat.grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </NativeSelect>
        </div>)}
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

      {afterOptions}
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

/** Material chips (single choice; choose again to clear). Only materials of this product / family are offered. */
export function MaterialChips({ materials, value, onChange, lang, disabled }: { materials: { code: string; name: string }[]; value: string | null; onChange: (c: string | null) => void; lang: Locale; disabled?: (code: string) => string | null }) {
  const ar = lang === "ar";
  return (
    <fieldset data-material-picker>
      <legend className="mb-2 text-sm font-semibold">{ar ? "المادة" : "Material"}</legend>
      <div role="radiogroup" aria-label={ar ? "المادة" : "Material"} className="flex flex-wrap gap-2">
        {materials.map((m) => { const on = value === m.code; const why = disabled?.(m.code) ?? null;
          return <button key={m.code} type="button" role="radio" aria-checked={on} disabled={!!why} title={why ?? m.name} data-code={m.code} onClick={() => onChange(on ? null : m.code)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-ink bg-ink text-white" : "border-steel-300 bg-white hover:border-primary"}`}>
            <span className="font-mono text-xs font-bold">{m.code}</span><span>{m.name}</span></button>; })}
      </div>
      {!value && <p className="mt-1.5 text-xs text-muted-foreground">{ar ? "اختر المادة لعرض الدرجات والتكوينات المتاحة بها." : "Choose a material to see its grades and the configurations offered in it."}</p>}
    </fieldset>);
}
