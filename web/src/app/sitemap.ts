import type { MetadataRoute } from "next";
import { getAllSlugsForSitemap } from "@/lib/queries/catalog";
import { siteUrl } from "@/lib/seo";

// Generated on request (then cached by crawlers/CDN), never frozen at build time, so it always reflects the live catalogue.
export const dynamic = "force-dynamic";

/** Only canonical, indexable public pages. A language version is listed only if it has genuine content (Arabic needs an Arabic name). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const { products, categories } = await getAllSlugsForSitemap();
  const entry = (path: string, o: { lastModified?: string; priority?: number; ar?: boolean } = {}) => {
    const langs = (o.ar === false ? ["en"] : ["en", "ar"]) as ("en" | "ar")[];
    const alternates = { languages: { ...Object.fromEntries(langs.map((l) => [l, `${site}/${l}${path}`])), "x-default": `${site}/en${path}` } };
    return langs.map((l) => ({ url: `${site}/${l}${path}`, lastModified: o.lastModified ? new Date(o.lastModified) : undefined, priority: o.priority ?? 0.6, alternates }));
  };
  return [
    ...entry("", { priority: 1 }), ...entry("/products", { priority: 0.9 }), ...entry("/rfq", { priority: 0.8 }), ...entry("/quality", { priority: 0.6 }),
    ...entry("/contact", { priority: 0.6 }), ...entry("/about", { priority: 0.5 }),
    ...categories.flatMap((c) => entry(`/category/${c.slug}`, { lastModified: c.updated_at, priority: 0.8, ar: !!c.name_ar })),
    ...products.flatMap((p) => entry(`/product/${p.slug}`, { lastModified: p.updated_at, priority: 0.7, ar: !!p.name_ar })),
  ];
}
