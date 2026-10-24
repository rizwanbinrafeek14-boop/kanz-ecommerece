import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`);

export interface PageSeo {
  lang: Locale; path: string;                      // path WITHOUT the language prefix, e.g. "/product/foo" ("" for the home page)
  title: string; description?: string;
  /** Which language versions really exist for this page. A language without genuine content must be false so it is neither linked nor indexed. */
  has?: { en?: boolean; ar?: boolean };
  noindex?: boolean; image?: string | null; ogTitle?: string | null; ogDescription?: string | null;
  canonicalQuery?: string;                         // e.g. "?page=2" for paginated listings (self-canonical)
  absoluteTitle?: boolean;
}

/** One place that produces title, description, canonical, hreflang (+ x-default), robots and social tags, so every page is consistent. */
export function pageMetadata(o: PageSeo): Metadata {
  const has = { en: o.has?.en ?? true, ar: o.has?.ar ?? true };
  const self = o.has?.[o.lang] ?? true;
  const languages: Record<string, string> = {};
  if (has.en) languages.en = `/en${o.path}`;
  if (has.ar) languages.ar = `/ar${o.path}`;
  if (has.en) languages["x-default"] = `/en${o.path}`;
  const index = !o.noindex && self;
  const canonical = `/${o.lang}${o.path}${o.canonicalQuery ?? ""}`;
  const title = o.ogTitle || o.title; const description = o.ogDescription || o.description;
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical, languages: index || self ? languages : undefined },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: { type: "website", siteName: "KANZ CORNER EST.", locale: o.lang === "ar" ? "ar_SA" : "en_US", alternateLocale: o.lang === "ar" ? "en_US" : "ar_SA", url: canonical, title, description, images: o.image ? [{ url: o.image }] : undefined },
    twitter: { card: o.image ? "summary_large_image" : "summary", title, description, images: o.image ? [o.image] : undefined },
  };
}

/** Query strings that only re-sort or filter a listing must not create indexable duplicates. Pagination is allowed (self-canonical). */
export function listingSeo(sp: Record<string, string | string[] | undefined>): { noindex: boolean; canonicalQuery: string } {
  const keys = Object.keys(sp).filter((k) => sp[k] !== undefined && sp[k] !== "");
  const nonPage = keys.filter((k) => k !== "page");
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  return { noindex: nonPage.length > 0, canonicalQuery: nonPage.length === 0 && page > 1 ? `?page=${Math.floor(page)}` : "" };
}
