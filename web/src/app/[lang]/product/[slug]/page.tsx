import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Lock, ChevronRight, FileText, Download, ShieldCheck } from "lucide-react";
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
import { ProductTabs } from "@/components/storefront/product-tabs";
import { DimensionsPanel } from "@/components/storefront/dimensions-panel";

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
    name: loc(d.product, "name", lang), sku: d.product.sku ?? (d.variants.length === 1 ? d.variants[0].sku : null), shortDesc: loc(d.product, "short_desc", lang), brand: d.brand ? (lang === "ar" && d.brand.name_ar ? d.brand.name_ar : d.brand.name) : null,
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

  const ar = lang === "ar";
  const optLabel = Object.fromEntries(d.options.map((o) => [o.key, Object.fromEntries(o.values.map((v) => [v.value, (ar && v.label_ar) || v.label_en]))]));
  const vLabel = (opts?: Record<string, string>) => d.options.map((o) => optLabel[o.key]?.[opts?.[o.key] ?? ""] ?? "").filter(Boolean).join(" · ");
  const prodStd = (p.specs?.standards ?? []).filter((x) => x.scope === "product");
  const specRows: [string, React.ReactNode][] = [
    ...(d.brand ? [[dict.common.brand, ar && d.brand.name_ar ? d.brand.name_ar : d.brand.name] as [string, React.ReactNode]] : []),
    ...(p.manufacturer_ref ? [[ar ? "مرجع الشركة المصنعة" : "Manufacturer reference", <span key="r" dir="ltr" className="font-mono">{p.manufacturer_ref}</span>] as [string, React.ReactNode]] : []),
    ...(d.family ? [[ar ? "عائلة المنتج" : "Product family", (ar && d.family.name_ar) || d.family.name_en] as [string, React.ReactNode]] : []),
    ...d.options.map((o) => [(ar && o.name_ar) || o.name_en, o.values.map((v) => (ar && v.label_ar) || v.label_en).join(" · ")] as [string, React.ReactNode]),
    ...(prodStd.length ? [[ar ? "المواصفات القياسية" : "Standards", prodStd.map((x) => x.code).join(", ")] as [string, React.ReactNode]] : []),
    ...(p.country_of_origin ? [[ar ? "بلد الصنع" : "Country of manufacture", p.country_of_origin] as [string, React.ReactNode]] : []),
    ...d.attributes.map((a) => [(ar && a.def.name_ar) || a.def.name_en, a.values.map((v) => (ar && v.value_ar) || v.value_en).join(" · ")] as [string, React.ReactNode]),
  ];
  const showWeights = d.variants.some((v) => v.weight_kg != null); const showCodes = d.variants.some((v) => v.manufacturer_code);
  const sourceNote = p.source_ref?.pages?.length ? (ar ? `البيانات كما نشرتها الشركة المصنعة (${d.brand?.name ?? ""})، صفحة ${p.source_ref.pages.join("، ")}. يرجى تأكيد المواصفة في طلب عرض السعر.` : `Data as published by the manufacturer (${d.brand?.name ?? ""}), catalogue page ${p.source_ref.pages.join(", ")}. Please confirm the specification in your request for quotation.`) : null;
  const tabs = [
    { id: "specs", label: dict.product.specs, content: (
      <div className="space-y-8">
        {specRows.length > 0 && <div className="overflow-hidden rounded-md border border-steel-200"><table className="w-full text-sm"><tbody>{specRows.map(([k, v], i) => <tr key={i} className="border-b border-steel-100 last:border-0 odd:bg-steel-50/60"><th scope="row" className="w-1/3 p-3 text-start align-top font-semibold">{k}</th><td className="p-3">{v}</td></tr>)}</tbody></table></div>}
        {d.variants.length > 0 && <div>
          <h3 className="mb-3 font-semibold">{dict.product.variants}</h3>
          <div className="overflow-x-auto rounded-md border border-steel-200"><table className="w-full text-sm">
            <thead className="bg-steel-50 text-xs text-steel-700"><tr><th scope="col" className="p-2.5 text-start">{dict.common.sku}</th>{d.options.length ? d.options.map((o) => <th key={o.key} scope="col" className="p-2.5 text-start">{(ar && o.name_ar) || o.name_en}</th>) : ["size", "grade", "schedule", "pressure_class"].map((h) => <th key={h} scope="col" className="p-2.5 text-start">{dict.filters[h as "size"]}</th>)}{showCodes && <th scope="col" className="p-2.5 text-start">{ar ? "رمز المصنع" : "Mfr code"}</th>}{showWeights && <th scope="col" className="p-2.5 text-end">{ar ? "الوزن (كجم)" : "Weight (kg)"}</th>}</tr></thead>
            <tbody>{d.variants.map((v) => <tr key={v.id} className="border-t border-steel-100"><td className="p-2.5 font-mono" dir="ltr">{v.sku}</td>{d.options.length ? d.options.map((o) => <td key={o.key} className="p-2.5 font-mono">{optLabel[o.key]?.[v.options?.[o.key] ?? ""] ?? "—"}</td>) : [v.size, v.grade, v.schedule, v.pressure_class].map((x, i) => <td key={i} className="p-2.5">{x ?? "—"}</td>)}{showCodes && <td className="p-2.5 font-mono" dir="ltr">{v.manufacturer_code ?? "—"}</td>}{showWeights && <td className="p-2.5 text-end font-mono tabular-nums">{v.weight_kg != null ? Number(v.weight_kg).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}</td>}</tr>)}</tbody>
          </table></div>
        </div>}
        {sourceNote && <p className="text-xs text-steel-500">{sourceNote}</p>}
      </div>) },
    ...(d.dimensionTables.length ? [{ id: "dims", label: ar ? "الأبعاد" : "Dimensions", content: <DimensionsPanel tables={d.dimensionTables} optionLabels={optLabel}
        variants={d.variants.filter((v) => v.options && Object.keys(v.options).length).map((v) => ({ id: v.id, options: v.options!, label: vLabel(v.options) }))}
        drawings={Object.fromEntries(d.dimensionTables.map((t) => [t.id, publicUrl("product-images", t.drawing_path)]))}
        labels={ar ? { selected: "المحدد", none: "لا توجد أبعاد منشورة لهذا الاختيار.", showAll: "عرض جميع المقاسات ({n})", showFewer: "عرض المقاس المحدد فقط", source: "المصدر: كتالوج الشركة المصنعة", drawing: "رسم الأبعاد", asPublished: "رسم الأبعاد كما نشرته الشركة المصنعة (ليس رسماً هندسياً معتمداً)." }
          : { selected: "Selected", none: "No dimensions are published for this selection.", showAll: "Show all sizes ({n})", showFewer: "Show the selected size only", source: "Source: manufacturer catalogue", drawing: "Dimensional drawing", asPublished: "Dimensional drawing as published by the manufacturer (not a certified engineering drawing)." }} /> }] : []),
    ...((p.specs?.materials?.length || p.specs?.standards?.length || p.specs?.notes?.length) ? [{ id: "materials", label: ar ? "المواد والمواصفات" : "Materials & standards", content: (
      <div className="space-y-6 text-sm">
        {!!p.specs?.materials?.length && <div><h3 className="mb-2 font-semibold">{ar ? "المواد" : "Materials"}</h3><ul className="space-y-1">{p.specs.materials.map((m, i) => <li key={i}><span className="font-medium">{m.type}</span>{m.grades.length ? <span className="font-mono text-steel-700"> — {m.grades.join(", ")}</span> : <span className="text-steel-500"> — {ar ? "الدرجات غير مذكورة في الكتالوج" : "grades not listed in the catalogue"}</span>}</li>)}</ul></div>}
        {!!p.specs?.standards?.length && <div><h3 className="mb-2 font-semibold">{ar ? "المواصفات القياسية" : "Standards"}</h3><ul className="space-y-1">{p.specs.standards.map((x, i) => <li key={i}><span className="font-mono">{x.code}</span> <span className="text-steel-500">— {x.scope === "product" ? (ar ? "لهذا المنتج" : "for this product") : (ar ? "مذكورة بشكل عام في الكتالوج" : "mentioned generally in the catalogue")}</span></li>)}</ul></div>}
        {!!p.specs?.notes?.length && <div><h3 className="mb-2 font-semibold">{ar ? "ملاحظات الكتالوج" : "Catalogue notes"}</h3><ul className="list-disc space-y-1 ps-5 text-steel-700">{p.specs.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
      </div>) }] : []),
    ...((ar ? p.applications_ar || p.applications_en : p.applications_en) ? [{ id: "applications", label: ar ? "الاستخدامات" : "Applications", content: <ul className="list-disc space-y-1 ps-5 text-sm">{((ar ? p.applications_ar || p.applications_en : p.applications_en) ?? "").split("\n").filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul> }] : []),
  ];

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
            {d.brand && <>{dict.common.brand}: <span className="font-medium text-foreground">{lang === "ar" && d.brand.name_ar ? d.brand.name_ar : d.brand.name}</span>{p.sku ? " · " : ""}</>}
            {p.sku && <>{dict.common.sku}: <span dir="ltr" className="font-mono text-foreground">{p.sku}</span></>}
          </p>
          {loc(p, "short_desc", lang) && <p className="mt-4 text-muted-foreground">{loc(p, "short_desc", lang)}</p>}
          <div className="mt-5">
            <BuyBox approvals={certs} approvalLabels={approvalLabels} lang={lang} dict={dict} url={url} vatRate={vatRateOf(settings)} whatsapp={whatsappNumber(widget, s(settings, "company_whatsapp"))} waGreeting={lang === "ar" ? (widget?.default_message_ar ?? dict.product.shareWhatsapp) : (widget?.default_message_en ?? dict.product.shareWhatsapp)}
              product={{ id: p.id, slug: p.slug, name, unit: p.unit, quoteOnly: p.is_quote_only, basePrice: p.base_price, minQty: Number(p.min_order_qty), image: d.images[0]?.storage_path ?? null }}
              datasheet={`/api/datasheet/${p.slug}`} options={d.options.map((o) => ({ key: o.key, name: (lang === "ar" && o.name_ar) || o.name_en, values: o.values.map((v) => ({ value: v.value, label: (lang === "ar" && v.label_ar) || v.label_en })) }))}
              variants={d.variants.map((v) => ({ id: v.id, options: v.options, sku: v.sku, label: loc(v, "label", lang) || [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), spec: [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), price: v.price, available: v.available }))} />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2 lg:row-start-1">
          <ProductTabs tabs={tabs} />
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
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" aria-hidden="true" />{dict.account.signInToDownload}</p>
              <ul className="space-y-2">
                {d.documents.map((doc) => (
                  <li key={doc.id}><TrackedLink event="datasheet_download" product={p.id} href={`/api/document/${doc.id}?lang=${lang}`} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
