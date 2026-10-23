import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, loc } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCategoryBySlug } from "@/lib/queries/catalog";
import { Listing, type RawParams } from "@/components/storefront/listing";

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }): Promise<Metadata> {
  const { lang, slug } = await params; const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat || !isLocale(lang)) return {};
  return {
    title: loc(cat, "seo_title", lang) || loc(cat, "name", lang),
    description: loc(cat, "seo_desc", lang) || loc(cat, "description", lang) || undefined,
    alternates: { canonical: `/${lang}/category/${slug}`, languages: { en: `/en/category/${slug}`, ar: `/ar/category/${slug}` } },
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<RawParams> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  return <Listing lang={lang} dict={getDictionary(lang)} category={category} sp={await searchParams} basePath={`/${lang}/category/${slug}`} />;
}
