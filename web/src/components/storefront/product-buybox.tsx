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
import type { ConfigChoice } from "@/lib/types";
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
  /** Configuration choices that do not change the catalogue variant (winding metal, filler, sheet material, thickness …); written into the enquiry. */
  choices?: ConfigChoice[];
  approvalLabels: ApprovalLabels; vatRate: number; whatsapp: string; waGreeting: string; lang: Locale; dict: Dictionary; url: string;
}

export function BuyBox({ product, variants: allVariants, options = [], datasheet, approvals, approvalLabels, vatRate, whatsapp, waGreeting, lang, dict, url, initialSel, onSelChange, brandName, afterOptions, materials = [], material: matProp, onMaterialChange, materialControlled, choices = [] }: BuyProps) {
  const { add } = useCart(); const ar = lang === "ar";
  const choiceMaterials = choices.some((c) => c.values?.some((x) => x.material));   // composite products: materials are chosen per component below
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
  const fromUrl = React.useCallback(() => { const m = new URLSearchParams(window.location.search).get("material")?.toUpperCase(); if (m && (materials.some((x) => x.code === m) || choices.some((c) => c.values?.some((x) => x.material === m)))) setMatOwn(m); }, [materials, choices]);
  React.useEffect(() => { if (materialControlled) return; const t = setTimeout(fromUrl, 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // only variants that are made in the chosen material (a variant without its own material carries all of the product's materials)
  const variants = React.useMemo(() => (material && !choiceMaterials ? allVariants.filter((x) => !x.material || x.material === material) : allVariants), [allVariants, material, choiceMaterials]);
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
  const canBuy = !product.quoteOnly && !!v && price != null && (stock ?? 0) >= qty;   // configuration choices are checked separately (blocked)
  const t = price != null ? withVat(price * qty, vatRate) : null;

  // configuration choices
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const fits = (req?: Record<string, string[]>) => !req || Object.entries(req).every(([k, vs]) => vs.includes(sel[k] ?? ""));
  const shown = choices.filter((c) => fits(c.requires) && (!c.requires_choice || Object.entries(c.requires_choice).every(([k, vs]) => vs.includes(picked[k] ?? ""))));
  const valueOf = (c: ConfigChoice) => { const x = picked[c.key] ?? ""; if (c.type === "select") return c.values?.some((o) => o.value === x && fits(o.requires)) ? x : ""; if (c.type === "number") { const n = Number(x); return x !== "" && Number.isFinite(n) && (c.min == null || n >= c.min) && (c.max == null || n <= c.max) ? x : ""; } return x.trim(); };
  const missing = shown.filter((c) => c.required && !valueOf(c));
  const choiceSpec = shown.filter((c) => valueOf(c)).map((c) => { const x = valueOf(c); const o = c.values?.find((y) => y.value === x); return `${(ar && c.name_ar) || c.name_en}: ${o ? (ar && o.label_ar) || o.label_en : x}${c.unit && !o ? ` ${c.unit}` : ""}`; }).join(" · ");
  const matSpec = !choiceMaterials && mat ? [`${mat.name} (${mat.code})`, grade && `${ar ? "الدرجة" : "Grade"} ${grade}`].filter(Boolean).join(" · ") : "";
  const fullSpec = [v?.spec, matSpec, choiceSpec].filter(Boolean).join(" · ") || undefined;
  // the same item with another material / grade / configuration is a separate enquiry line
  const lineMat = [!choiceMaterials && mat ? `${mat.code}${grade ? `/${grade}` : ""}` : "", choiceSpec ? hash(choiceSpec) : ""].filter(Boolean).join("|") || undefined;
  const blocked = missing.length > 0;
  const flash = (k: "cart" | "quote") => { setJustAdded(k); setTimeout(() => setJustAdded(null), 1600); };
  const base = { productId: product.id, slug: product.slug, name: product.name, image: product.image, unit: product.unit, qty };
  const waLines = [`${waGreeting}`.trim(), `${dict.product.waProduct}: ${product.name}`, brandName && `${dict.common.brand}: ${brandName}`, v?.sku && `${dict.product.waSku}: ${v.sku}`, fullSpec && `${dict.product.waVariant}: ${fullSpec}`, `${dict.product.waQty}: ${qty} ${product.unit}`, `${dict.product.waLink}: ${url}`].filter(Boolean);
  const wa = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waLines.join("\n"))}`;
  const addQuote = () => { add({ ...base, kind: "quote", variantId: v?.id, sku: v?.sku, spec: fullSpec, material: lineMat }); flash("quote"); toast.success(`${dict.product.added}: ${product.name}`); };
  const addCart = () => { add({ ...base, kind: "cart", variantId: v!.id, sku: v!.sku, spec: fullSpec, material: lineMat, unitPrice: price }); flash("cart"); toast.success(`${dict.product.added}: ${product.name}`); };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      {!materialControlled && !choiceMaterials && materials.length > 0 && <MaterialChips materials={materials} value={material} onChange={setMaterial} lang={lang} />}
      {!choiceMaterials && mat && mat.grades.length > 0 && (
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

      {shown.length > 0 && <ConfigChoices choices={shown} sel={sel} fits={fits} picked={picked} onPick={(k, x) => setPicked((p) => ({ ...p, [k]: x }))} lang={lang} focusMaterial={choiceMaterials ? material : null}
        onClearMaterial={() => setMaterial(null)} materialName={(code) => code} />}
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
          <Button size="lg" disabled={!canBuy || blocked} onClick={addCart}>
            {justAdded === "cart" ? <Check className="size-5" /> : <ShoppingCart className="size-5" />} {dict.product.addToCart}
          </Button>
        )}
        <Button size="lg" variant={product.quoteOnly ? "default" : "outline"} className={product.quoteOnly ? "sm:col-span-2" : ""} onClick={addQuote} disabled={blocked} aria-describedby={blocked ? "cfg-missing" : undefined}>
          {justAdded === "quote" ? <Check className="size-5" /> : <ClipboardPlus className="size-5" />} {product.quoteOnly ? dict.product.requestQuote : dict.product.addToQuote}
        </Button>
      </div>
      {blocked && <p id="cfg-missing" role="status" className="-mt-2 text-sm text-amber-800">{ar ? "يرجى اختيار: " : "Please choose: "}{missing.map((c) => (ar && c.name_ar) || c.name_en).join(", ")}</p>}
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
          {!product.quoteOnly && canBuy && !blocked ? <Button size="lg" className="h-12 shrink-0" onClick={addCart}><ShoppingCart className="size-5" />{dict.product.addToCart}</Button>
            : <Button size="lg" className="h-12 shrink-0" onClick={addQuote} disabled={blocked}><ClipboardPlus className="size-5" />{product.quoteOnly ? dict.product.requestQuote : dict.product.addToQuote}</Button>}
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

const hash = (t: string) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/**
 * Configuration choices (winding metal, filler, ring materials, sheet, thickness …). Only choices and values that apply to the selected
 * configuration are offered (e.g. PTFE filler only with an inner ring). With a material from the shop filter (?material=SS) the lists show
 * that material's values first, without choosing one for the customer.
 */
function ConfigChoices({ choices, picked, onPick, lang, fits, focusMaterial, onClearMaterial }: {
  choices: ConfigChoice[]; sel: Record<string, string>; picked: Record<string, string>; onPick: (k: string, v: string) => void; lang: Locale;
  fits: (req?: Record<string, string[]>) => boolean; focusMaterial: string | null; onClearMaterial: () => void; materialName: (c: string) => string;
}) {
  const ar = lang === "ar";
  return (
    <div className="space-y-4" data-config-choices>
      {focusMaterial && <p className="flex flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm">
        {ar ? "المادة من بحثك:" : "Material from your search:"} <span className="rounded border border-primary bg-primary px-1.5 font-mono text-xs font-semibold text-white">{focusMaterial}</span>
        <span className="text-muted-foreground">{ar ? "اختر الدرجة أدناه." : "choose the exact grade below."}</span>
        <button type="button" onClick={onClearMaterial} className="ms-auto text-xs font-medium text-primary underline">{ar ? "عرض كل المواد" : "Show all materials"}</button></p>}
      {choices.map((c) => {
        const id = `cfg-${c.key}`; const name = (ar && c.name_ar) || c.name_en; const hint = (ar && c.hint_ar) || c.hint_en; const val = picked[c.key] ?? "";
        const values = (c.values ?? []).filter((o) => fits(o.requires));
        const focus = focusMaterial ? values.filter((o) => o.material === focusMaterial) : [];
        const list = focus.length ? [...focus, ...values.filter((o) => !focus.includes(o))] : values;
        return (
          <div key={c.key} className="space-y-1.5" data-choice={c.key}>
            <Label htmlFor={id}>{name}{c.required && <span className="text-primary" aria-hidden="true"> *</span>}{c.unit && <span className="ms-1 font-normal text-muted-foreground">({c.unit})</span>}</Label>
            {c.type === "select" ? (
              <NativeSelect id={id} value={values.some((o) => o.value === val) ? val : ""} required={c.required} onChange={(e) => onPick(c.key, e.target.value)}>
                <option value="">{ar ? "اختر…" : "Select…"}</option>
                {focus.length > 0 && <optgroup label={focusMaterial!}>{focus.map((o) => <option key={o.value} value={o.value}>{(ar && o.label_ar) || o.label_en}</option>)}</optgroup>}
                {(focus.length ? list.slice(focus.length) : list).map((o) => <option key={o.value} value={o.value}>{(ar && o.label_ar) || o.label_en}</option>)}
              </NativeSelect>
            ) : (
              <Input id={id} type={c.type === "number" ? "number" : "text"} inputMode={c.type === "number" ? "decimal" : undefined} min={c.min} max={c.max} step={c.step} maxLength={c.maxlength}
                required={c.required} value={val} onChange={(e) => onPick(c.key, e.target.value)} placeholder={c.type === "number" && c.min != null && c.max != null ? `${c.min} – ${c.max}` : undefined} />
            )}
            {(hint || (c.type === "select" && values.find((o) => o.value === val)?.hint_en)) && <p className="text-xs text-muted-foreground">{c.type === "select" && values.find((o) => o.value === val)?.hint_en ? values.find((o) => o.value === val)!.hint_en : hint}</p>}
          </div>);
      })}
    </div>);
}
