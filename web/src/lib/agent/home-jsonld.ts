import "server-only";
import { getFlagged, type CategoryNode } from "@/lib/queries/catalog";
import { cardPrice } from "@/lib/types";
import { mainImage } from "@/lib/images/display";
import { productLd } from "@/lib/jsonld";
import { abs, siteUrl } from "@/lib/seo";
import { publicUrl } from "@/lib/format";

/**
 * Homepage structured data beyond the LocalBusiness block in the layout: the website with its product search, the
 * business's catalogue of product categories, and the featured products shown on the page (Product; an Offer with price and
 * currency only where the shop has set a real price — quotation-only items carry no price).
 */
export async function homeGraph(lang: "en" | "ar", tree: CategoryNode[], nm: (c: { name_en: string; name_ar: string | null }) => string) {
  const base = siteUrl(); const business = { "@id": `${base}/#business` };
  const featured = await getFlagged("featured", 12);
  const products = featured.map((p) => {
    const img = mainImage(p.product_images); const price = p.family ? p.family.price : cardPrice(p);
    const slug = p.family?.slug ?? p.slug; const name = p.family ? nm(p.family) : nm(p);
    const { "@context": _c, ...ld } = productLd({ name, description: ((lang === "ar" && p.short_desc_ar) || p.short_desc_en) ?? undefined, url: abs(`/${lang}/product/${slug}`),
      images: [publicUrl("product-images", p.family?.image_path ?? img?.storage_path)].filter(Boolean) as string[], sku: p.sku ?? undefined,
      brand: p.family ? p.family.brands[0]?.name : p.brands?.name ?? undefined, prices: price != null ? [Number(price)] : [], anyInStock: false });
    void _c;
    return ld;
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${base}/#website`, url: abs(`/${lang}`), name: "KANZ CORNER EST.", inLanguage: lang === "ar" ? "ar-SA" : "en", publisher: business,
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${abs(`/${lang}/products`)}?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
      { "@type": "OfferCatalog", "@id": `${base}/#catalog`, name: lang === "ar" ? "فئات المنتجات" : "Product categories", provider: business,
        itemListElement: tree.map((c, i) => ({ "@type": "OfferCatalog", position: i + 1, name: nm(c), url: abs(`/${lang}/category/${c.slug}`),
          ...(c.children.length ? { itemListElement: c.children.map((x, j) => ({ "@type": "OfferCatalog", position: j + 1, name: nm(x), url: abs(`/${lang}/category/${x.slug}`) })) } : {}) })) },
      ...(products.length ? [{ "@type": "ItemList", "@id": `${base}/#featured`, name: lang === "ar" ? "منتجات مختارة" : "Featured products",
        itemListElement: products.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) }] : []),
      { "@type": "WebPage", "@id": `${abs(`/${lang}`)}#page`, url: abs(`/${lang}`), isPartOf: { "@id": `${base}/#website` }, about: business,
        mainEntity: products.length ? { "@id": `${base}/#featured` } : { "@id": `${base}/#catalog` } },
    ],
  };
}
