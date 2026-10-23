import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/en/account", "/ar/account", "/en/checkout", "/ar/checkout", "/en/cart", "/ar/cart"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
