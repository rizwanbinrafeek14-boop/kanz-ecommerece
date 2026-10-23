import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, vatRateOf } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-5">{dict.checkout.signInFirst}</p>
        <div className="flex justify-center gap-3">
          <Button asChild><Link href={`/${lang}/account/login?next=/${lang}/checkout`}>{dict.account.login}</Link></Button>
          <Button asChild variant="outline"><Link href={`/${lang}/account/register`}>{dict.account.register}</Link></Button>
        </div>
      </div>
    );
  }
  const settings = await getSettings();
  const sb = await createClient();
  const { data: profile } = await sb.from("profiles").select("full_name, phone").eq("id", user.id).single();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{dict.checkout.title}</h1>
      <CheckoutForm lang={lang} dict={dict} vatRate={vatRateOf(settings)} options={{ delivery: (settings["public.delivery_options"] as any)?.delivery ?? true, pickup: (settings["public.delivery_options"] as any)?.pickup ?? true, bank_transfer: (settings["public.payment_methods"] as any)?.bank_transfer ?? true, cod: (settings["public.payment_methods"] as any)?.cod ?? false }} defaults={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "" }} />
    </div>
  );
}
