import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { loc, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { FamilyDetail, ProductDetail } from "@/lib/queries/catalog";
import { pageMetadata, abs } from "@/lib/seo";
import { breadcrumbLd, productGroupLd } from "@/lib/jsonld";
import { getSettings, s, vatRateOf } from "@/lib/settings";
import { publicUrl } from "@/lib/format";
import { getContact, whatsappNumber } from "@/lib/queries/contact";
import { getProductApprovals } from "@/lib/queries/certs";
import { FamilyView, type Offer } from "@/components/storefront/family-view";
import { placeholderKind } from "@/lib/images/placeholder";
import { imageNote, thumbOf } from "@/lib/images/display";
import { ProductViewTracker } from "@/components/storefront/page-tracker";

/** Picker order on family pages: material, size, connection, class/schedule (each brand only shows the options its catalogue lists). */
const ORDER = ["material", "grade", "size", "run", "outlet", "large", "small", "connection", "end", "type", "class", "pressure_class", "rating", "schedule"];
const rank = (k: string) => { const i = ORDER.indexOf(k); return i < 0 ? ORDER.length : i; };

const famName = (f: FamilyDetail["family"], lang: Locale) => (lang === "ar" && f.name_ar) || f.name_en;
const prodStandards = (d: ProductDetail) => (d.product.specs?.standards ?? []).filter((x) => x.scope === "product").map((x) => x.code);

export function familyMetadata(fd: FamilyDetail, lang: Locale): Metadata {
  const f = fd.family; const name = famName(f, lang);
  const brands = fd.offerings.map((o) => o.brand?.name).filter(Boolean) as string[];
  const stds = [...new Set(fd.offerings.flatMap(prodStandards))].slice(0, 3);
  const auto = lang === "ar"
    ? `${name} من ${brands.join("، ")}${stds.length ? ` - ${stds.join("، ")}` : ""}. قارن المواصفات والأبعاد لكل شركة واطلب عرض سعر من كنز كورنر.`
    : `${name} from ${brands.join(", ")}${stds.length ? ` - ${stds.join(", ")}` : ""}. Compare each manufacturer's specifications and dimensions and request a quotation from KANZ CORNER EST.`;
  return pageMetadata({
    lang, path: `/product/${f.slug}`, has: { ar: !!f.name_ar }, noindex: f.seo_noindex, image: publicUrl("product-images", f.image_path),
    title: loc(f, "seo_title", lang) || `${name} - ${brands.join(", ")}`.slice(0, 60), description: (loc(f, "seo_desc", lang) || loc(f, "short_desc", lang) || auto).slice(0, 158),
  });
}

function toOffer(d: ProductDetail, lang: Locale, approvals: Awaited<ReturnType<typeof getProductApprovals>>): Offer {
  const ar = lang === "ar"; const p = d.product;
  const opts = [...d.options].sort((a, b) => rank(a.key) - rank(b.key));
  const optionLabels = Object.fromEntries(opts.map((o) => [o.key, Object.fromEntries(o.values.map((v) => [v.value, (ar && v.label_ar) || v.label_en]))]));
  const brandName = d.brand ? (ar && d.brand.name_ar) || d.brand.name : "";
  const tableDrawings = Object.fromEntries(d.dimensionTables.map((t) => [t.id, publicUrl("product-images", t.drawing_path)]));
  const drawings = [...d.images.map((i) => ({ url: publicUrl("product-images", i.storage_path)!, thumb: publicUrl("product-images", i.thumb_path), note: imageNote(i, lang), alt: (ar ? i.alt_ar || i.alt_en : i.alt_en) || `${brandName} drawing` })),
    ...d.dimensionTables.filter((t) => t.drawing_path).map((t) => ({ url: tableDrawings[t.id]!, alt: (ar && t.title_ar) || t.title_en }))]
    .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i);
  const specRows: [string, string][] = [
    [ar ? "الشركة المصنعة" : "Manufacturer", brandName],
    [ar ? "المادة" : "Material", d.materials.length ? d.materials.map((m) => `${(ar && m.name_ar) || m.name_en} (${m.code})${m.grades.length ? `: ${m.grades.join(", ")}` : ""}`).join(" · ") : (ar ? "المادة غير مؤكدة - تُحدد في طلب عرض السعر" : "Material not verified - specify it in your request for quotation")],
    ...(p.manufacturer_ref ? [[ar ? "مرجع الشركة المصنعة" : "Manufacturer reference", p.manufacturer_ref] as [string, string]] : []),
    ...opts.map((o) => [(ar && o.name_ar) || o.name_en, o.values.map((v) => (ar && v.label_ar) || v.label_en).join(" · ")] as [string, string]),
    ...(prodStandards(d).length ? [[ar ? "المواصفات القياسية" : "Standards", prodStandards(d).join(", ")] as [string, string]] : []),
    ...(p.country_of_origin ? [[ar ? "بلد الصنع" : "Country of manufacture", p.country_of_origin] as [string, string]] : []),
  ];
  return {
    id: p.id, slug: p.slug, name: loc(p, "name", lang), unit: p.unit, quoteOnly: p.is_quote_only, basePrice: p.base_price, minQty: Number(p.min_order_qty), cartImage: thumbOf(d.images[0]),
    brand: { slug: d.brand?.slug ?? p.slug, name: brandName || loc(p, "name", lang), logo: publicUrl("brand-logos", d.brand?.logo_path) },
    options: opts.map((o) => ({ key: o.key, name: (ar && o.name_ar) || o.name_en, values: o.values.map((v) => ({ value: v.value, label: (ar && v.label_ar) || v.label_en })) })),
    variants: d.variants.map((v) => ({ id: v.id, options: v.options, sku: v.sku, label: loc(v, "label", lang) || [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "),
      spec: [brandName, ...opts.map((o) => optionLabels[o.key]?.[v.options?.[o.key] ?? ""])].filter(Boolean).join(" · "), price: v.price, available: v.available,
      weight: v.weight_kg == null ? null : Number(v.weight_kg), code: v.manufacturer_code ?? null, material: v.material_code ?? null })),
    shownMaterials: d.materials.map((m) => ({ code: m.code, name: (ar && m.name_ar) || m.name_en, grades: m.grades })), choices: p.specs?.choices ?? [],
    optionLabels, tables: d.dimensionTables, tableDrawings, drawings, specRows,
    standards: p.specs?.standards ?? [], materials: p.specs?.materials ?? [], notes: p.specs?.notes ?? [],
    documents: d.documents.map((x) => ({ id: x.id, title: x.title })),
    sourceNote: p.source_ref?.pages?.length ? (ar ? `البيانات كما نشرتها ${brandName} في كتالوجها، صفحة ${p.source_ref.pages.join("، ")}. يرجى تأكيد المواصفة في طلب عرض السعر.` : `Data as published by ${brandName} in its catalogue, page ${p.source_ref.pages.join(", ")}. Please confirm the specification in your request for quotation.`) : null,
    approvals,
  };
}

export async function FamilyPage({ fd, lang }: { fd: FamilyDetail; lang: Locale }) {
  const dict = getDictionary(lang); const f = fd.family; const name = famName(f, lang); const ar = lang === "ar";
  const [settings, { widget }, approvals] = await Promise.all([getSettings(), getContact(), Promise.all(fd.offerings.map((o) => getProductApprovals(o.product.id)))]);
  const offers = fd.offerings.map((o, i) => toOffer(o, lang, approvals[i]));
  const url = abs(`/${lang}/product/${f.slug}`);
  const familyImage = publicUrl("product-images", f.image_path);
  const crumbs = [{ name: dict.common.home, path: `/${lang}` }, ...(fd.category ? [{ name: loc(fd.category, "name", lang), path: `/${lang}/category/${fd.category.slug}` }] : []), { name, path: `/${lang}/product/${f.slug}` }];
  const ld = productGroupLd({ name, description: loc(f, "short_desc", lang) || loc(f, "description", lang), url, id: f.slug, images: familyImage ? [familyImage] : [], category: fd.category ? loc(fd.category, "name", lang) : undefined,
    offerings: fd.offerings.map((o, i) => ({ name: offers[i].name, brand: offers[i].brand.name, url: `${url}?brand=${offers[i].brand.slug}`, sku: o.product.sku, mpn: o.product.manufacturer_ref, standards: prodStandards(o) })) });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([ld, breadcrumbLd(crumbs)]).replace(/</g, "\\u003c") }} />
      <ProductViewTracker productId={offers[0].id} recent={{ slug: f.slug, name_en: f.name_en, name_ar: f.name_ar, image: f.image_path ?? thumbOf(fd.offerings[0].images[0]) }} />
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/${lang}`} className="hover:text-primary">{dict.common.home}</Link><ChevronRight className="size-3.5 rtl:rotate-180" />
        {fd.category && <><Link href={`/${lang}/category/${fd.category.slug}`} className="hover:text-primary">{loc(fd.category, "name", lang)}</Link><ChevronRight className="size-3.5 rtl:rotate-180" /></>}
        <span className="text-foreground">{name}</span>
      </nav>
      <FamilyView name={name} shortDesc={loc(f, "short_desc", lang) || null} familyImage={familyImage} offers={offers}
        placeholder={placeholderKind({ name_en: f.name_en, product_type: f.product_type, category_slug: fd.category?.slug })}
        galleryLabels={{ enlarge: dict.product.enlarge, zoomIn: dict.product.zoom, zoomOut: dict.product.zoomOut, close: dict.common.close, prev: dict.product.prevImg, next: dict.product.nextImg, image: ar ? "صورة" : "Image" }}
        approvalLabels={{ heading: dict.product.approvals, none: dict.product.approvalsNone, view: dict.product.viewCert, opensNew: dict.product.opensNew, number: dict.product.certNumber, scope: dict.product.certScope, validUntil: dict.product.certValid, issuer: dict.product.certIssuer }}
        common={{ lang, dict, url, vatRate: vatRateOf(settings), whatsapp: whatsappNumber(widget, s(settings, "company_whatsapp")), waGreeting: ar ? (widget?.default_message_ar ?? dict.product.shareWhatsapp) : (widget?.default_message_en ?? dict.product.shareWhatsapp),
          approvalLabels: { heading: dict.product.approvals, none: dict.product.approvalsNone, view: dict.product.viewCert, opensNew: dict.product.opensNew, number: dict.product.certNumber, scope: dict.product.certScope, validUntil: dict.product.certValid, issuer: dict.product.certIssuer } }} />
      {loc(f, "description", lang) && <section className="mt-12 max-w-3xl"><h2 className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{dict.product.description}</h2><div className="whitespace-pre-line leading-relaxed text-muted-foreground">{loc(f, "description", lang)}</div></section>}
    </div>
  );
}
