import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isLocale, loc } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCategoryBySlug, getCategories, getCategoryProductCounts, getSlugRedirect } from "@/lib/queries/catalog";
import { Listing, type RawParams } from "@/components/storefront/listing";
import { pageMetadata, listingSeo } from "@/lib/seo";
import { defaultCategoryDescription, defaultCategoryTitle } from "@/lib/seo-defaults";
import { breadcrumbLd } from "@/lib/jsonld";
import { publicUrl } from "@/lib/format";

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }): Promise<Metadata> {
  const { lang, slug } = await params; const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat || !isLocale(lang)) return {};
  const name = loc(cat, "name", lang);
  const counts = await getCategoryProductCounts();
  const { noindex, canonicalQuery } = listingSeo(sp);
  return pageMetadata({
    lang, path: `/category/${slug}`, canonicalQuery,
    title: loc(cat, "seo_title", lang) || defaultCategoryTitle(name, lang),
    description: loc(cat, "seo_desc", lang) || defaultCategoryDescription(name, loc(cat, "description", lang), lang),
    has: { ar: !!cat.name_ar }, image: publicUrl("category-images", cat.image_path),
    noindex: noindex || cat.seo_noindex || (counts.get(cat.id) ?? 0) === 0,   // empty categories stay out of search until they hold products
  });
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const category = await getCategoryBySlug(slug);
  if (!category) { const to = await getSlugRedirect("category", slug); if (to) permanentRedirect(`/${lang}/category/${to}`); notFound(); }
  const dict = getDictionary(lang);
  const cats = await getCategories(); const parent = category.parent_id ? cats.find((c) => c.id === category.parent_id) : null;
  const crumbs = [{ name: dict.common.home, path: `/${lang}` }, { name: dict.nav.products, path: `/${lang}/products` }, ...(parent ? [{ name: loc(parent, "name", lang), path: `/${lang}/category/${parent.slug}` }] : []), { name: loc(category, "name", lang), path: `/${lang}/category/${slug}` }];
  return (<>
    <Listing lang={lang} dict={dict} category={category} sp={await searchParams} basePath={`/${lang}/category/${slug}`} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(crumbs)) }} />
  </>);
}
