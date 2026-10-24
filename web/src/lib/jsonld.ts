import { abs } from "@/lib/seo";

/** Builders for schema.org JSON-LD. Everything comes from real, visible data; missing data is omitted rather than invented. */
export interface OrgInput { name: string; url: string; phone?: string; email?: string; street?: string; logo?: string; sameAs?: string[]; description?: string; hours?: string }
export function localBusinessLd(o: OrgInput) {
  return {
    "@context": "https://schema.org", "@type": "LocalBusiness", "@id": `${o.url}/#business`, name: o.name, url: o.url, description: o.description || undefined,
    logo: o.logo, image: o.logo, telephone: o.phone || undefined, email: o.email || undefined,
    address: { "@type": "PostalAddress", streetAddress: o.street || undefined, addressLocality: "Al Khobar", addressRegion: "Eastern Province", addressCountry: "SA" },
    areaServed: { "@type": "Country", name: "Saudi Arabia" },
    sameAs: o.sameAs?.length ? o.sameAs : undefined,
  };
}
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })) };
}
export interface ProductLdInput {
  name: string; description?: string; images: string[]; sku?: string; brand?: string; url: string; category?: string;
  prices: number[];                // ex-VAT prices of the variants/base price; empty for quotation-only products
  anyInStock: boolean;             // true only when the system really holds available stock
  properties?: { name: string; value: string }[];
}
export function productLd(p: ProductLdInput) {
  const prices = p.prices.filter((x) => Number.isFinite(x) && x > 0);
  const lo = prices.length ? Math.min(...prices) : null; const hi = prices.length ? Math.max(...prices) : null;
  const availability = p.anyInStock ? { availability: "https://schema.org/InStock" } : {};     // never claim OutOfStock/InStock without real stock data
  const offers = lo == null ? undefined
    : lo === hi
      ? { "@type": "Offer", url: p.url, priceCurrency: "SAR", price: lo.toFixed(2), priceSpecification: { "@type": "UnitPriceSpecification", price: lo.toFixed(2), priceCurrency: "SAR", valueAddedTaxIncluded: false }, ...availability }
      : { "@type": "AggregateOffer", url: p.url, priceCurrency: "SAR", lowPrice: lo.toFixed(2), highPrice: hi!.toFixed(2), offerCount: prices.length, ...availability };
  return {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description || undefined, image: p.images.length ? p.images : undefined,
    sku: p.sku || undefined, brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined, category: p.category || undefined, url: p.url,
    additionalProperty: p.properties?.length ? p.properties.slice(0, 12).map((x) => ({ "@type": "PropertyValue", name: x.name, value: x.value })) : undefined,
    offers,
  };
}
