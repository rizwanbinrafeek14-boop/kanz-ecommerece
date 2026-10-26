import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getBrandBySlug } from "@/lib/queries/catalog";
import { Listing, type RawParams } from "@/components/storefront/listing";
import { pageMetadata, listingSeo } from "@/lib/seo";
import { breadcrumbLd } from "@/lib/jsonld";
import { publicUrl } from "@/lib/format";

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }): Promise<Metadata> {
  const { lang, slug } = await params; const sp = await searchParams;
  const b = await getBrandBySlug(slug);
  if (!b || !isLocale(lang)) return {};
  const name = (lang === "ar" && b.name_ar) || b.name;
  const { noindex, canonicalQuery } = listingSeo(sp);
  return pageMetadata({
    lang, path: `/brand/${slug}`, canonicalQuery, has: { ar: true }, image: publicUrl("brand-logos", b.logo_path), noindex,
    title: lang === "ar" ? `منتجات ${name} | KanzCorner` : `${name} pipe fittings & valves | KanzCorner`,
    description: lang === "ar" ? `تصفح منتجات ${name} حسب المادة والمقاس ونوع التوصيل وفئة الضغط، واطلب عرض سعر.` : `Browse ${name} products by material, size, connection and pressure class, with manufacturer drawings and dimensions. Request a quotation from KanzCorner.`,
  });
}

export default async function BrandPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();
  const dict = getDictionary(lang);
  const crumbs = [{ name: dict.common.home, path: `/${lang}` }, { name: dict.nav.products, path: `/${lang}/products` }, { name: (lang === "ar" && brand.name_ar) || brand.name, path: `/${lang}/brand/${slug}` }];
  return (<>
    <Listing lang={lang} dict={dict} brand={brand} sp={await searchParams} basePath={`/${lang}/brand/${slug}`} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(crumbs)) }} />
  </>);
}
