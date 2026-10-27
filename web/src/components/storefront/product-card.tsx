import Link from "next/link";
import { cardPrice, type ProductCard as PC } from "@/lib/types";
import { loc, type Locale } from "@/lib/i18n/config";
import { formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "./product-image";
import { mainImage, thumbOf } from "@/lib/images/display";
import { placeholderKind } from "@/lib/images/placeholder";
import { QuickAddQuote } from "./quick-add";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** "Materials: CS | SS" - the active Material filter is highlighted. */
function Materials({ p, lang, active }: { p: PC; lang: Locale; active?: string[] }) {
  const all = p.materials ?? []; const ar = lang === "ar";
  if (!all.length) return null;
  // composite products can list many materials: active filter first, then up to 6 badges and "+n"
  const sorted = [...all.filter((m) => active?.includes(m.code)), ...all.filter((m) => !active?.includes(m.code))];
  const ms = sorted.slice(0, 6); const more = sorted.slice(6);
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs" data-materials={all.map((m) => m.code).join(" ")}>
      <span className="text-muted-foreground">{ar ? "المواد:" : "Materials:"}</span>
      {ms.map((m) => { const on = active?.includes(m.code);
        return <abbr key={m.code} title={(ar && m.name_ar) || m.name_en} data-active={on ? "true" : undefined}
          className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold no-underline ${on ? "border-primary bg-primary text-white" : "border-steel-300 text-steel-700"}`}>{m.code}</abbr>; })}
      {more.length > 0 && <abbr title={more.map((m) => (ar && m.name_ar) || m.name_en).join(", ")} className="font-mono text-[11px] text-steel-600 no-underline">+{more.length}</abbr>}
    </p>);
}
/** Link to the product page, carrying the material the shopper filtered on (first one this card has). */
const withMaterial = (href: string, p: PC, active?: string[]) => { const m = active?.find((c) => p.materials?.some((x) => x.code === c)); return m ? `${href}?material=${encodeURIComponent(m)}` : href; };

/** One card for a whole product family: name, brand list and a link to the family page, where the customer chooses the manufacturer. */
function FamilyCard({ p, lang, dict, active }: { p: PC; lang: Locale; dict: Dictionary; active?: string[] }) {
  const f = p.family!; const ar = lang === "ar";
  const name = (ar && f.name_ar) || f.name_en;
  const img = f.image_path ?? thumbOf(mainImage(p.product_images));
  const brands = f.brands.map((b) => (ar && b.name_ar) || b.name);
  const href = withMaterial(`/${lang}/product/${f.slug}`, p, active);
  const n = brands.length;
  return (
    <article data-family={f.slug} className="group flex flex-col overflow-hidden rounded-md border border-steel-200 bg-card transition duration-300 hover:-translate-y-0.5 hover:border-steel-700 hover:shadow-[6px_6px_0_0_var(--steel-200)] motion-reduce:transform-none">
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <ProductImage path={img} alt="" lang={lang} placeholder={placeholderKind({ name_en: f.name_en, product_type: f.product_type, category_slug: p.categories?.slug })} className="aspect-square w-full bg-steel-50 p-3 transition duration-500 group-hover:scale-[1.06]" />
        {n > 1 && <span className="absolute end-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">{ar ? `${n} علامات` : `${n} brands`}</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug"><Link href={href} className="hover:text-primary">{name}</Link></h3>
        <Materials p={p} lang={lang} active={active} />
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{ar ? (n === 1 ? "متوفر من علامة واحدة" : `متوفر من ${n} علامات`) : `Available in ${n} brand${n === 1 ? "" : "s"}`}</span>{n ? `: ${brands.join(", ")}` : ""}</p>
        <div className="mt-auto pt-1">
          {f.price != null ? <p className="text-base font-bold"><span className="me-1 text-xs font-normal text-muted-foreground">{ar ? "من" : "From"}</span>{formatSAR(f.price, lang)} <span className="text-xs font-normal text-muted-foreground">{dict.common.exVat}</span></p>
            : <p className="text-sm font-medium text-muted-foreground">{dict.product.priceOnRequest}</p>}
        </div>
        <Link href={href} className="flex min-h-10 items-center justify-center rounded-md border border-steel-300 text-sm font-semibold hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ar ? "عرض المنتج" : "View product"}<span className="sr-only">: {name}</span></Link>
      </div>
    </article>
  );
}

export function ProductCard({ p, lang, dict, activeMaterials }: { p: PC; lang: Locale; dict: Dictionary; activeMaterials?: string[] }) {
  if (p.family) return <FamilyCard p={p} lang={lang} dict={dict} active={activeMaterials} />;
  const href = withMaterial(`/${lang}/product/${p.slug}`, p, activeMaterials);
  const img = thumbOf(mainImage(p.product_images));
  const name = loc(p, "name", lang);
  const price = cardPrice(p);
  const hasVariants = (p.product_variants ?? []).filter((v) => v.is_active && v.price != null).length > 1 && p.base_price == null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-md border border-steel-200 bg-card transition duration-300 hover:-translate-y-0.5 hover:border-steel-700 hover:shadow-[6px_6px_0_0_var(--steel-200)] motion-reduce:transform-none">
      <Link href={href} className="relative block">
        <ProductImage path={img} alt={name} lang={lang} placeholder={placeholderKind({ placeholder_kind: p.placeholder_kind, name_en: p.name_en, category_slug: p.categories?.slug })} className="aspect-square w-full bg-steel-50 p-3 transition duration-500 group-hover:scale-[1.06]" />
        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {p.is_special_offer && <Badge>{loc(p, "offer_label", lang) || dict.product.offer}</Badge>}
          {p.is_new_arrival && <Badge variant="dark">{dict.product.new}</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.sku && <span className="spec-label truncate text-steel-500" dir="ltr">{p.sku}</span>}
        {p.brands && <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "ar" && p.brands.name_ar ? p.brands.name_ar : p.brands.name}</span>}
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug"><Link href={href} className="hover:text-primary">{name}</Link></h3>
        <Materials p={p} lang={lang} active={activeMaterials} />
        <div className="mt-auto pt-1">
          {price != null ? (
            <p className="text-base font-bold">{hasVariants && <span className="me-1 text-xs font-normal text-muted-foreground">{lang === "ar" ? "من" : "From"}</span>}{formatSAR(price, lang)} <span className="text-xs font-normal text-muted-foreground">{dict.common.exVat}</span></p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">{dict.product.priceOnRequest}</p>
          )}
        </div>
        {/* products that need configuration choices (material, thickness …) are configured on their page so the enquiry is complete */}
        {p.specs?.choices?.some((c) => c.required)
          ? <Link href={href} className="flex min-h-10 items-center justify-center rounded-md border border-steel-300 text-sm font-semibold hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{lang === "ar" ? "اختر المواصفات" : "Choose options"}<span className="sr-only">: {name}</span></Link>
          : <QuickAddQuote product={{ id: p.id, slug: p.slug, name, image: img, unit: p.unit }} label={dict.product.addToQuote} addedLabel={dict.product.added} />}
      </div>
    </article>
  );
}

export function ProductGrid({ products, lang, dict, activeMaterials }: { products: PC[]; lang: Locale; dict: Dictionary; activeMaterials?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => <ProductCard key={p.family?.slug ?? p.id} p={p} lang={lang} dict={dict} activeMaterials={activeMaterials} />)}
    </div>
  );
}
