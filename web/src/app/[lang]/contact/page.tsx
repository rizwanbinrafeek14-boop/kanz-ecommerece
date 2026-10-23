import { notFound } from "next/navigation";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, s } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").static.contactTitle, alternates: { languages: { en: "/en/contact", ar: "/ar/contact" } } };
}
export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const st = await getSettings();
  const rows = [
    { Icon: Phone, label: s(st, "company_phone"), href: `tel:${s(st, "company_phone").replace(/\s/g, "")}`, dir: "ltr" as const },
    { Icon: Mail, label: s(st, "company_email_sales"), href: `mailto:${s(st, "company_email_sales")}` },
    ...(s(st, "company_email_info") ? [{ Icon: Mail, label: s(st, "company_email_info"), href: `mailto:${s(st, "company_email_info")}` }] : []),
    { Icon: MapPin, label: s(st, "company_address_en"), href: undefined },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 border-s-4 border-primary ps-3 text-3xl font-bold">{dict.static.contactTitle}</h1>
      <ul className="space-y-4">
        {rows.map(({ Icon, label, href, dir }, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border p-4"><Icon className="mt-0.5 size-5 shrink-0 text-primary" />{href ? <a href={href} dir={dir} className="font-medium hover:text-primary">{label}</a> : <span>{label}</span>}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        {s(st, "company_whatsapp") && <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"><a href={`https://wa.me/${s(st, "company_whatsapp")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{dict.nav.whatsapp}</a></Button>}
        <Button asChild variant="dark"><Link href={`/${lang}/rfq`}>{dict.nav.rfq}</Link></Button>
      </div>
    </div>
  );
}
