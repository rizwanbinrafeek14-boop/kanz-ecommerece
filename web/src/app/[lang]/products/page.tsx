import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata, listingSeo } from "@/lib/seo";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Listing, type RawParams } from "@/components/storefront/listing";

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<RawParams> }): Promise<Metadata> {
  const { lang } = await params; const sp = await searchParams; const l = isLocale(lang) ? lang : "en";
  const { noindex, canonicalQuery } = listingSeo(sp);
  return pageMetadata({ lang: l, path: "/products", noindex, canonicalQuery,
    title: l === "ar" ? "المنتجات — أنابيب ووصلات وفلنجات ومحابس صناعية" : "Products — industrial pipes, fittings, flanges & valves",
    description: l === "ar" ? "تصفح الأنابيب والوصلات والوصلات المخددة والفلنجات والمحابس (الصمامات) والمثبتات لدى كنز كورنر، واطلب عرض سعر." : "Browse pipes, pipe fittings, grooved fittings, flanges, valves and fasteners from KANZ CORNER EST. and request a quotation." });
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<RawParams> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <Listing lang={lang} dict={getDictionary(lang)} sp={await searchParams} basePath={`/${lang}/products`} />;
}
