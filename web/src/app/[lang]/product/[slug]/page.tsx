import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Download } from "lucide-react";
import { isLocale, loc } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProductBySlug } from "@/lib/queries/catalog";
import { getSettings, s, vatRateOf } from "@/lib/settings";
import { publicUrl } from "@/lib/format";
import { Gallery } from "@/components/storefront/gallery";
import { BuyBox } from "@/components/storefront/product-buybox";
import { ProductGrid } from "@/components/storefront/product-card";
import { ProductViewTracker } from "@/components/storefront/page-tracker";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  const d = await getProductBySlug(slug);
  if (!d || !isLocale(lang)) return {};
  const p = d.product;
  const img = publicUrl("product-images", d.images[0]?.storage_path);
  return {
    title: loc(p, "seo_title", lang) || loc(p, "name", lang),
    description: loc(p, "seo_desc", lang) || loc(p, "short_desc", lang) || undefined,
    alternates: { canonical: `/${lang}/product/${slug}`, languages: { en: `/en/product/${slug}`, ar: `/ar/product/${slug}` } },
    openGraph: { title: loc(p, "name", lang), images: img ? [img] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const d = await getProductBySlug(slug);
  if (!d) notFound();
  const dict = getDictionary(lang);
  const settings = await getSettings();
  const { product: p } = d;
  const name = loc(p, "name", lang);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${site}/${lang}/product/${slug}`;
  const images = d.images.map((i) => ({ url: publicUrl("product-images", i.storage_path)!, needsHires: i.needs_hires }));
  const minPrice = p.is_quote_only ? null : (p.base_price ?? Math.min(...d.variants.map((v) => v.price ?? Infinity)));

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name, description: loc(p, "short_desc", lang) || undefined, sku: p.sku ?? undefined,
    image: images.map((i) => i.url), brand: d.brand ? { "@type": "Brand", name: d.brand.name } : undefined,
    ...(minPrice != null && Number.isFinite(minPrice) ? { offers: { "@type": "Offer", priceCurrency: "SAR", price: minPrice, url, availability: d.variants.some((v) => v.available > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } } : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/${lang}`} className="hover:text-primary">{dict.common.home}</Link><ChevronRight className="size-3.5 rtl:rotate-180" />
        {d.category && <><Link href={`/${lang}/category/${d.category.slug}`} className="hover:text-primary">{loc(d.category, "name", lang)}</Link><ChevronRight className="size-3.5 rtl:rotate-180" /></>}
        <span className="text-foreground">{name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
        <Gallery images={images} alt={name} />
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {p.is_special_offer && <Badge>{loc(p, "offer_label", lang) || dict.product.offer}</Badge>}
            {p.is_new_arrival && <Badge variant="dark">{dict.product.new}</Badge>}
            {p.is_quote_only && <Badge variant="secondary">{dict.product.productFamily}</Badge>}
          </div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {d.brand && <>{dict.common.brand}: <span className="font-medium text-foreground">{lang === "ar" && d.brand.name_ar ? d.brand.name_ar : d.brand.name}</span> · </>}
            {p.sku && <>{dict.common.sku}: <span dir="ltr" className="font-mono text-foreground">{p.sku}</span></>}
          </p>
          {loc(p, "short_desc", lang) && <p className="mt-4 text-muted-foreground">{loc(p, "short_desc", lang)}</p>}
          <div className="mt-5">
            <BuyBox lang={lang} dict={dict} url={url} vatRate={vatRateOf(settings)} whatsapp={s(settings, "company_whatsapp")}
              product={{ id: p.id, slug: p.slug, name, unit: p.unit, quoteOnly: p.is_quote_only, basePrice: p.base_price, minQty: Number(p.min_order_qty), image: d.images[0]?.storage_path ?? null }}
              variants={d.variants.map((v) => ({ id: v.id, sku: v.sku, label: loc(v, "label", lang) || [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), spec: [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), price: v.price, available: v.available }))} />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-10">
          {d.attributes.length > 0 && (
            <section>
              <h2 className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.specs}</h2>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <tbody>
                    {d.attributes.map((a) => (
                      <tr key={a.def.id} className="border-b last:border-0 odd:bg-muted/40">
                        <th className="w-1/3 p-3 text-start font-semibold align-top">{lang === "ar" && a.def.name_ar ? a.def.name_ar : a.def.name_en}</th>
                        <td className="p-3">{a.values.map((v) => (lang === "ar" && v.value_ar ? v.value_ar : v.value_en)).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {d.variants.length > 0 && (
            <section>
              <h2 className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.variants}</h2>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr>
                    {["sku", "size", "grade", "schedule", "pressure_class"].map((h) => <th key={h} className="p-3 text-start">{h === "sku" ? dict.common.sku : dict.filters[h as "size"]}</th>)}
                  </tr></thead>
                  <tbody>{d.variants.map((v) => (
                    <tr key={v.id} className="border-t"><td className="p-3 font-mono" dir="ltr">{v.sku}</td><td className="p-3">{v.size ?? "—"}</td><td className="p-3">{v.grade ?? "—"}</td><td className="p-3">{v.schedule ?? "—"}</td><td className="p-3">{v.pressure_class ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
          {loc(p, "description", lang) && (
            <section>
              <h2 className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.description}</h2>
              <div className="whitespace-pre-line leading-relaxed text-muted-foreground">{loc(p, "description", lang)}</div>
            </section>
          )}
        </div>
        {d.documents.length > 0 && (
          <aside>
            <h2 className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.documents}</h2>
            <ul className="space-y-2">
              {d.documents.map((doc) => (
                <li key={doc.id}><a href={publicUrl("product-docs", doc.storage_path) ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:border-primary hover:text-primary">
                  <FileText className="size-5 text-primary" /><span className="flex-1">{doc.title}</span><Download className="size-4" />
                </a></li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {d.alternatives.length > 0 && <section className="mt-14"><h2 className="mb-5 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.alternatives}</h2><ProductGrid products={d.alternatives} lang={lang} dict={dict} /></section>}
      {d.related.length > 0 && <section className="mt-14"><h2 className="mb-5 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.related}</h2><ProductGrid products={d.related} lang={lang} dict={dict} /></section>}

      <ProductViewTracker productId={p.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
