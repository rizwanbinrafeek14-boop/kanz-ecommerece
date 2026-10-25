import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight, FileText, Download, ShieldCheck } from "lucide-react";
import { isLocale, loc } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProductBySlug, getSlugRedirect } from "@/lib/queries/catalog";
import { pageMetadata, abs } from "@/lib/seo";
import { defaultProductDescription, defaultProductTitle, type SeoProductInput } from "@/lib/seo-defaults";
import { breadcrumbLd, productLd } from "@/lib/jsonld";
import { TrackedLink } from "@/components/storefront/tracked-link";
import { getSettings, s, vatRateOf } from "@/lib/settings";
import { publicUrl } from "@/lib/format";
import { Gallery } from "@/components/storefront/gallery";
import { BuyBox } from "@/components/storefront/product-buybox";
import { ProductGrid } from "@/components/storefront/product-card";
import { ProductViewTracker } from "@/components/storefront/page-tracker";
import { Badge } from "@/components/ui/badge";
import { getContact, whatsappNumber } from "@/lib/queries/contact";
import { getProductApprovals } from "@/lib/queries/certs";
import { ApprovalsSection, type ApprovalLabels } from "@/components/storefront/approvals";

export const revalidate = 60;
// No pages are pre-rendered at build time; each product is generated on first visit, then cached and refreshed every 60s (and instantly when an admin saves).
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  const d = await getProductBySlug(slug);
  if (!d || !isLocale(lang)) return {};
  const p = d.product;
  const img = publicUrl("product-images", p.og_image_path ?? d.images[0]?.storage_path);
  const input = seoInput(d, lang);
  return pageMetadata({
    lang, path: `/product/${slug}`, has: { ar: !!p.name_ar }, noindex: p.seo_noindex, image: img,
    title: loc(p, "seo_title", lang) || defaultProductTitle(input, lang), description: loc(p, "seo_desc", lang) || defaultProductDescription(input, lang),
    ogTitle: loc(p, "og_title", lang) || null, ogDescription: loc(p, "og_desc", lang) || null,
  });
}

/** Real catalogue facts used for generated titles/descriptions. */
function seoInput(d: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>, lang: "en" | "ar"): SeoProductInput {
  const std = d.attributes.find((a) => /standard/i.test(a.def.key) || /standard/i.test(a.def.name_en));
  return {
    name: loc(d.product, "name", lang), sku: d.product.sku ?? d.variants[0]?.sku, shortDesc: loc(d.product, "short_desc", lang), brand: d.brand ? (lang === "ar" && d.brand.name_ar ? d.brand.name_ar : d.brand.name) : null,
    sizes: d.variants.map((v) => v.size), grades: d.variants.map((v) => v.grade), standards: std ? std.values.map((v) => (lang === "ar" && v.value_ar ? v.value_ar : v.value_en)) : [],
  };
}

export default async function ProductPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const d = await getProductBySlug(slug);
  if (!d) { const to = await getSlugRedirect("product", slug); if (to) permanentRedirect(`/${lang}/product/${to}`); notFound(); }
  const dict = getDictionary(lang);
  const [settings, { widget }, certs] = await Promise.all([getSettings(), getContact(), getProductApprovals(d.product.id)]);
  const { product: p } = d;
  const approvalLabels: ApprovalLabels = { heading: dict.product.approvals, none: dict.product.approvalsNone, view: dict.product.viewCert, opensNew: dict.product.opensNew, number: dict.product.certNumber, scope: dict.product.certScope, validUntil: dict.product.certValid, issuer: dict.product.certIssuer };
  const name = loc(p, "name", lang);
  const url = abs(`/${lang}/product/${slug}`);
  const images = d.images.map((i, n) => ({ url: publicUrl("product-images", i.storage_path)!, needsHires: i.needs_hires, alt: (lang === "ar" ? i.alt_ar || i.alt_en : i.alt_en) || `${name}${d.images.length > 1 ? ` — ${lang === "ar" ? "صورة" : "image"} ${n + 1}` : ""}` }));

  const input = seoInput(d, lang);
  const prices = p.is_quote_only ? [] : [p.base_price, ...d.variants.map((v) => v.price)].filter((x): x is number => x != null && x > 0);
  const jsonLd = productLd({
    name, description: loc(p, "seo_desc", lang) || defaultProductDescription(input, lang), images: images.map((i) => i.url), sku: input.sku ?? undefined, brand: input.brand ?? undefined, url,
    category: d.category ? loc(d.category, "name", lang) : undefined, prices, anyInStock: d.variants.some((v) => v.available > 0),
    properties: d.attributes.map((a) => ({ name: lang === "ar" && a.def.name_ar ? a.def.name_ar : a.def.name_en, value: a.values.map((v) => (lang === "ar" && v.value_ar ? v.value_ar : v.value_en)).join(", ") })),
  });
  const crumbs = [{ name: dict.common.home, path: `/${lang}` }, ...(d.category ? [{ name: loc(d.category, "name", lang), path: `/${lang}/category/${d.category.slug}` }] : []), { name, path: `/${lang}/product/${slug}` }];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-6">
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/${lang}`} className="hover:text-primary">{dict.common.home}</Link><ChevronRight className="size-3.5 rtl:rotate-180" />
        {d.category && <><Link href={`/${lang}/category/${d.category.slug}`} className="hover:text-primary">{loc(d.category, "name", lang)}</Link><ChevronRight className="size-3.5 rtl:rotate-180" /></>}
        <span className="text-foreground">{name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
        <Gallery images={images} alt={name} labels={{ enlarge: dict.product.enlarge, zoomIn: dict.product.zoom, zoomOut: dict.product.zoomOut, close: dict.common.close, prev: dict.product.prevImg, next: dict.product.nextImg, image: lang === "ar" ? "صورة" : "Image" }} />
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
            <BuyBox approvals={certs} approvalLabels={approvalLabels} lang={lang} dict={dict} url={url} vatRate={vatRateOf(settings)} whatsapp={whatsappNumber(widget, s(settings, "company_whatsapp"))} waGreeting={lang === "ar" ? (widget?.default_message_ar ?? dict.product.shareWhatsapp) : (widget?.default_message_en ?? dict.product.shareWhatsapp)}
              product={{ id: p.id, slug: p.slug, name, unit: p.unit, quoteOnly: p.is_quote_only, basePrice: p.base_price, minQty: Number(p.min_order_qty), image: d.images[0]?.storage_path ?? null }}
              variants={d.variants.map((v) => ({ id: v.id, sku: v.sku, label: loc(v, "label", lang) || [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), spec: [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), price: v.price, available: v.available }))} />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2 lg:row-start-1">
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
          <ApprovalsSection approvals={certs} lang={lang} labels={approvalLabels} />
        </div>
        {d.documents.length > 0 && (
          <aside className="order-first lg:order-none lg:col-start-3 lg:row-start-1" aria-labelledby="docs-h">
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 lg:sticky lg:top-32">
              <h2 id="docs-h" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />{dict.product.documents}</h2>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">{dict.product.docsHint}</p>
              <ul className="space-y-2">
                {d.documents.map((doc) => (
                  <li key={doc.id}><TrackedLink event="datasheet_download" product={p.id} href={publicUrl("product-docs", doc.storage_path) ?? "#"} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="flex-1">{doc.title}</span><Download className="size-4 shrink-0" aria-hidden="true" />
                  </TrackedLink></li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {d.alternatives.length > 0 && <section className="mt-14"><h2 className="mb-5 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.alternatives}</h2><ProductGrid products={d.alternatives} lang={lang} dict={dict} /></section>}
      {d.related.length > 0 && <section className="mt-14"><h2 className="mb-5 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.related}</h2><ProductGrid products={d.related} lang={lang} dict={dict} /></section>}

      <ProductViewTracker productId={p.id} recent={{ slug: p.slug, name_en: p.name_en, name_ar: p.name_ar, image: d.images[0]?.storage_path ?? null }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd(crumbs)]) }} />
    </div>
  );
}
