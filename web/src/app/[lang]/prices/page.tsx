import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getPricedProducts } from "@/lib/queries/catalog";
import { cardPrice } from "@/lib/types";
import { mainImage } from "@/lib/images/display";
import { productLd } from "@/lib/jsonld";
import { abs, pageMetadata } from "@/lib/seo";
import { formatSAR, publicUrl } from "@/lib/format";
import { getSettings, vatRateOf } from "@/lib/settings";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "/prices", title: l === "ar" ? "الأسعار" : "Prices",
    description: l === "ar" ? "قائمة الأسعار المنشورة لدى كنز كورنر بالريال السعودي (قبل ضريبة القيمة المضافة)، وكيفية تسعير بقية المنتجات بعرض سعر." : "KANZ CORNER published prices in Saudi riyals (excluding VAT), and how all other items are priced by quotation." });
}

/**
 * Price list: every published product with a real price (base price or a size's price; never estimated), as plain HTML that
 * works without JavaScript or login, with Product/Offer structured data. Everything else is quoted on request — explained here.
 */
export default async function PricesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const ar = lang === "ar";
  const [products, settings] = await Promise.all([getPricedProducts(), getSettings()]);
  const vat = vatRateOf(settings);
  const rows = products.map((p) => {
    const name = (ar && p.name_ar) || p.name_en; const price = cardPrice(p)!; const url = `/${lang}/product/${p.slug}`;
    const prices = [p.base_price, ...(p.product_variants ?? []).filter((v) => v.is_active).map((v) => v.price)].filter((x): x is number => x != null).map(Number);
    return { id: p.id, name, url, brand: (ar && p.brands?.name_ar) || p.brands?.name || null, price, many: new Set(prices).size > 1,
      ld: (({ "@context": _c, ...x }) => x)(productLd({ name, url: abs(url), images: [publicUrl("product-images", mainImage(p.product_images)?.storage_path)].filter(Boolean) as string[],
        sku: p.sku ?? undefined, brand: p.brands?.name ?? undefined, prices, anyInStock: false })) };
  });
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: ar ? "قائمة الأسعار" : "Price list", url: abs(`/${lang}/prices`),
    numberOfItems: rows.length, itemListElement: rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, item: r.ld })) };
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">{ar ? "الأسعار" : "Prices"}</h1>
      <div className="mt-4 space-y-2 text-muted-foreground" data-pricing-policy>
        <p>{ar ? `الأسعار بالريال السعودي وقبل ضريبة القيمة المضافة (${vat}%). الشحن يُسعَّر منفصلاً.` : `Prices are in Saudi riyals (SAR) and exclude VAT (${vat}%). Delivery is quoted separately.`}</p>
        <p>{ar ? "معظم منتجاتنا (الأنابيب والوصلات والفلنجات والمحابس والجوانات) تُسعَّر بعرض سعر حسب المقاس والدرجة والمواصفة والكمية. أرسل طلب عرض سعر وسنرد بالسعر ومدة التوريد." : "Most of our range (pipes, fittings, flanges, valves, gaskets) is priced by quotation, because the price depends on size, material grade, standard and quantity. Send a request for quotation and we reply with prices and lead time."}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><Button asChild><Link href={`/${lang}/rfq`}>{ar ? "اطلب عرض سعر" : "Request a quotation"}</Link></Button>
        <Button asChild variant="outline"><Link href={`/${lang}/products`}>{ar ? "تصفح المنتجات" : "Browse products"}</Link></Button></div>
      <h2 className="mb-3 mt-10 text-lg font-semibold">{ar ? `منتجات بأسعار منشورة (${rows.length})` : `Products with published prices (${rows.length})`}</h2>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm" data-price-list>
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th scope="col" className="p-3 text-start">{ar ? "المنتج" : "Product"}</th><th scope="col" className="p-3 text-start">{ar ? "العلامة" : "Brand"}</th><th scope="col" className="p-3 text-end">{ar ? "السعر (قبل الضريبة)" : "Price (ex. VAT)"}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3"><Link href={r.url} className="font-medium hover:text-primary">{r.name}</Link></td><td className="p-3 text-muted-foreground">{r.brand ?? "—"}</td>
            <td className="p-3 text-end font-semibold tabular-nums">{r.many ? (ar ? "من " : "from ") : ""}{formatSAR(r.price, lang)}</td></tr>)}</tbody>
        </table></div>
      ) : <p className="rounded-xl border p-5 text-muted-foreground">{ar ? "جميع المنتجات حالياً تُسعَّر بعرض سعر." : "All items are currently priced by quotation."}</p>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </div>
  );
}
