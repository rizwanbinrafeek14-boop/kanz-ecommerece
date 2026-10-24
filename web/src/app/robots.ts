import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** robots.txt only guides well-behaved crawlers; it is not a security control (admin and account pages are protected by login and also marked noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/auth/", "/en/account", "/ar/account", "/en/checkout", "/ar/checkout", "/en/cart", "/ar/cart"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
