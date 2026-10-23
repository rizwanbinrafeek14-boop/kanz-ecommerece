import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Listing, type RawParams } from "@/components/storefront/listing";

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<RawParams> }): Promise<Metadata> {
  const { lang } = await params; const sp = await searchParams;
  const dict = getDictionary(isLocale(lang) ? lang : "en");
  const hasFilters = Object.keys(sp).length > 0;
  return { title: dict.nav.products, alternates: { canonical: `/${lang}/products`, languages: { en: "/en/products", ar: "/ar/products" } }, robots: hasFilters ? { index: false, follow: true } : undefined };
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<RawParams> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <Listing lang={lang} dict={getDictionary(lang)} sp={await searchParams} basePath={`/${lang}/products`} />;
}
