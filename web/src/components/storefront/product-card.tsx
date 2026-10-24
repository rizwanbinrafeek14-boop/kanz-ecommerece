import Link from "next/link";
import { cardPrice, type ProductCard as PC } from "@/lib/types";
import { loc, type Locale } from "@/lib/i18n/config";
import { formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "./product-image";
import { QuickAddQuote } from "./quick-add";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProductCard({ p, lang, dict }: { p: PC; lang: Locale; dict: Dictionary }) {
  const img = [...(p.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
  const name = loc(p, "name", lang);
  const price = cardPrice(p);
  const hasVariants = (p.product_variants ?? []).filter((v) => v.is_active && v.price != null).length > 1 && p.base_price == null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl motion-reduce:transform-none">
      <Link href={`/${lang}/product/${p.slug}`} className="relative block">
        <ProductImage path={img?.storage_path} alt={name} className="aspect-square w-full bg-gradient-to-b from-white to-muted/60 p-3 transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {p.is_special_offer && <Badge>{loc(p, "offer_label", lang) || dict.product.offer}</Badge>}
          {p.is_new_arrival && <Badge variant="dark">{dict.product.new}</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.brands && <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "ar" && p.brands.name_ar ? p.brands.name_ar : p.brands.name}</span>}
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug"><Link href={`/${lang}/product/${p.slug}`} className="hover:text-primary">{name}</Link></h3>
        <div className="mt-auto pt-1">
          {price != null ? (
            <p className="text-base font-bold">{hasVariants && <span className="me-1 text-xs font-normal text-muted-foreground">{lang === "ar" ? "من" : "From"}</span>}{formatSAR(price, lang)} <span className="text-xs font-normal text-muted-foreground">{dict.common.exVat}</span></p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">{dict.product.priceOnRequest}</p>
          )}
        </div>
        <QuickAddQuote product={{ id: p.id, slug: p.slug, name, image: img?.storage_path ?? null, unit: p.unit }} label={dict.product.addToQuote} addedLabel={dict.product.added} />
      </div>
    </article>
  );
}

export function ProductGrid({ products, lang, dict }: { products: PC[]; lang: Locale; dict: Dictionary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} p={p} lang={lang} dict={dict} />)}
    </div>
  );
}
