import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, isLocale, dirOf } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, s } from "@/lib/settings";
import { CartProvider } from "@/components/storefront/cart-provider";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { PageTracker } from "@/components/storefront/page-tracker";
import { WhatsAppFloat } from "@/components/storefront/whatsapp-float";
import { Toaster } from "@/components/ui/sonner";

export const revalidate = 60;
export function generateStaticParams() { return LOCALES.map((lang) => ({ lang })); }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const settings = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: s(settings, "seo_default_title", "KANZ CORNER EST."), template: "%s | KANZ CORNER EST." },
    description: s(settings, "seo_default_description"),
    alternates: { languages: { en: "/en", ar: "/ar" } },
    openGraph: { siteName: "KANZ CORNER EST.", locale: lang === "ar" ? "ar_SA" : "en_US", type: "website" },
  };
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const settings = await getSettings();
  const orgJsonLd = {
    "@context": "https://schema.org", "@type": "Organization", name: "KANZ CORNER EST.", url: process.env.NEXT_PUBLIC_SITE_URL,
    telephone: s(settings, "company_phone"), email: s(settings, "company_email_sales"),
    address: { "@type": "PostalAddress", streetAddress: s(settings, "company_address_en"), addressCountry: "SA" },
  };
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <CartProvider>
          <Header lang={lang} />
          <main className="flex-1">{children}</main>
          <Footer lang={lang} />
          <WhatsAppFloat number={s(settings, "company_whatsapp")} text={dict.product.shareWhatsapp} label={dict.nav.whatsapp} />
          <PageTracker lang={lang} />
          <Toaster />
        </CartProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </body>
    </html>
  );
}
