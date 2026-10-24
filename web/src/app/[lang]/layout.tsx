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
import { ContactFloat } from "@/components/storefront/whatsapp-float";
import { getContact } from "@/lib/queries/contact";
import { publicUrl } from "@/lib/format";
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
  const [settings, { widget, links }] = await Promise.all([getSettings(), getContact()]);
  const ar = lang === "ar";
  const waNumber = widget ? (widget.whatsapp_enabled ? widget.whatsapp_number : "") : s(settings, "company_whatsapp").replace(/\D/g, "");
  const waText = widget ? (ar ? widget.default_message_ar : widget.default_message_en) : dict.product.shareWhatsapp;
  const callNumber = widget ? (widget.show_call ? (widget.call_number || s(settings, "company_phone")).replace(/[^\d+]/g, "") : "") : "";
  const orgJsonLd = {
    "@context": "https://schema.org", "@type": "Organization", name: "KANZ CORNER EST.", url: process.env.NEXT_PUBLIC_SITE_URL,
    telephone: s(settings, "company_phone"), email: s(settings, "company_email_sales"),
    address: { "@type": "PostalAddress", streetAddress: s(settings, "company_address_en"), addressCountry: "SA" },
  };
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <a href="#main" className="skip-link">{lang === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}</a>
        <CartProvider>
          <Header lang={lang} />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
          <Footer lang={lang} />
          <ContactFloat whatsappHref={waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : null}
            whatsappLabel={widget ? (ar ? widget.label_ar : widget.label_en) : dict.nav.whatsapp} whatsappDescription={widget ? (ar ? widget.description_ar : widget.description_en) : ""}
            iconUrl={publicUrl("site-icons", widget?.icon_path)} callHref={callNumber ? `tel:${callNumber}` : null} callLabel={dict.nav.call}
            menuLabel={widget ? (ar ? widget.menu_label_ar : widget.menu_label_en) : dict.nav.contactUs} closeLabel={dict.common.close}
            position={widget?.position ?? "right"} showDesktop={widget?.show_desktop ?? true} showMobile={widget?.show_mobile ?? true} links={links.filter((l) => l.show_floating)} />
          <PageTracker lang={lang} />
          <Toaster />
        </CartProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </body>
    </html>
  );
}
