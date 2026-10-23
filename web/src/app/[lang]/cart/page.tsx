import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, vatRateOf } from "@/lib/settings";
import { CartView } from "@/components/storefront/cart-view";

export const metadata = { title: "Cart", robots: { index: false } };
export const revalidate = 60;

export default async function CartPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{dict.cart.title}</h1>
      <CartView lang={lang} dict={dict} vatRate={vatRateOf(await getSettings())} />
    </div>
  );
}
