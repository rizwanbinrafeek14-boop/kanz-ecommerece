import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { Phone, Mail, MapPin, MessageCircle, Clock, Navigation } from "lucide-react";
import { breadcrumbLd } from "@/lib/jsonld";
import { TrackedLink } from "@/components/storefront/tracked-link";
import { getContact, whatsappNumber } from "@/lib/queries/contact";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, s } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "/contact", title: getDictionary(l).static.contactTitle, description: l === "ar" ? "تواصل مع مؤسسة كنز كورنر في الخبر، المملكة العربية السعودية: العنوان والهاتف والبريد وواتساب لاستفسارات الأنابيب والوصلات والفلنجات والمحابس." : "Contact KANZ CORNER EST. in Al Khobar, Saudi Arabia: address, phone, email and WhatsApp for pipes, fittings, flanges and valves enquiries." });
}
export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang); const ar = lang === "ar";
  const [st, { widget }] = await Promise.all([getSettings(), getContact()]);
  const address = (ar && s(st, "company_address_ar")) || s(st, "company_address_en");
  const hours = (ar && s(st, "company_hours_ar")) || s(st, "company_hours_en");
  const wa = whatsappNumber(widget, s(st, "company_whatsapp"));
  const phone = s(st, "company_phone");
  const rows = [
    { Icon: MapPin, label: address, href: undefined, title: ar ? "العنوان" : "Address" },
    { Icon: Phone, label: phone, href: `tel:${phone.replace(/\s/g, "")}`, dir: "ltr" as const, title: ar ? "الهاتف" : "Phone", track: true },
    { Icon: Mail, label: s(st, "company_email_sales"), href: `mailto:${s(st, "company_email_sales")}`, title: ar ? "المبيعات" : "Sales" },
    ...(s(st, "company_email_info") ? [{ Icon: Mail, label: s(st, "company_email_info"), href: `mailto:${s(st, "company_email_info")}`, title: ar ? "معلومات عامة" : "General" }] : []),
    ...(hours ? [{ Icon: Clock, label: hours, href: undefined, title: ar ? "ساعات العمل" : "Opening hours" }] : []),
  ];
  const crumbs = [{ name: dict.common.home, path: `/${lang}` }, { name: dict.static.contactTitle, path: `/${lang}/contact` }];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 border-s-4 border-primary ps-3 text-3xl font-bold">{dict.static.contactTitle}</h1>
      <p className="mb-6 text-muted-foreground">{ar ? "مؤسسة كنز كورنر مقرها في الخبر بالمنطقة الشرقية. نورّد الأنابيب والوصلات والفلنجات والمحابس إلى العملاء في أنحاء المملكة، ويتم تأكيد ترتيبات التسليم ومدد التوريد في عرض السعر لكل طلب." : "KANZ CORNER EST. is based in Al Khobar, Eastern Province. We supply pipes, fittings, flanges and valves to customers across Saudi Arabia; delivery arrangements and lead times are confirmed in the quotation for each order."}</p>
      <ul className="space-y-4">
        {rows.map(({ Icon, label, href, dir, title, track }, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border p-4"><Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
              {href ? (track ? <TrackedLink event="phone_click" href={href} dir={dir} className="font-medium hover:text-primary">{label}</TrackedLink> : <a href={href} dir={dir} className="font-medium hover:text-primary">{label}</a>) : <span>{label}</span>}</div></li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        {address && <Button asChild variant="outline"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s(st, "company_address_en") || address)}`} target="_blank" rel="noopener noreferrer"><Navigation className="size-4" aria-hidden="true" />{ar ? "الاتجاهات على الخريطة" : "Get directions"}<span className="sr-only"> ({ar ? "تفتح في نافذة جديدة" : "opens in a new tab"})</span></a></Button>}
        {wa && <Button asChild className="bg-[#0f7a40] text-white hover:bg-[#0b6b38]"><TrackedLink event="whatsapp_click" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />{dict.nav.whatsapp}</TrackedLink></Button>}
        <Button asChild variant="dark"><Link href={`/${lang}/rfq`}>{dict.nav.rfq}</Link></Button>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(crumbs)) }} />
    </div>
  );
}
