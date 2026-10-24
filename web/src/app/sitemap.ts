import type { MetadataRoute } from "next";
import { getAllSlugsForSitemap } from "@/lib/queries/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { products, categories } = await getAllSlugsForSitemap();
  const both = (path: string, lastModified?: string, priority = 0.6) =>
    (["en", "ar"] as const).map((l) => ({
      url: `${site}/${l}${path}`, lastModified: lastModified ? new Date(lastModified) : undefined, priority,
      alternates: { languages: { en: `${site}/en${path}`, ar: `${site}/ar${path}` } },
    }));
  return [
    ...both("", undefined, 1), ...both("/products", undefined, 0.9), ...both("/rfq", undefined, 0.8), ...both("/about"), ...both("/quality"), ...both("/contact"),
    ...categories.flatMap((c) => both(`/category/${c.slug}`, c.updated_at, 0.8)),
    ...products.flatMap((p) => both(`/product/${p.slug}`, p.updated_at, 0.7)),
  ];
}
