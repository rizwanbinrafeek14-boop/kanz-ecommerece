import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { getMenu } from "@/lib/queries/catalog";
import { getSettings, s } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loc, type Locale } from "@/lib/i18n/config";

export async function Footer({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang);
  const [settings, company, products, support, legal] = await Promise.all([
    getSettings(), getMenu("footer_company"), getMenu("footer_products"), getMenu("footer_support"), getMenu("footer_legal"),
  ]);
  const col = (title: string, links: typeof company) => links.length > 0 && (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">{title}</h3>
      <ul className="space-y-2 text-sm">
        {links.map((l) => <li key={l.id}><Link href={l.url.startsWith("/") ? `/${lang}${l.url}` : l.url} className="text-white/70 hover:text-white">{loc(l, "label", lang)}</Link></li>)}
      </ul>
    </div>
  );
  return (
    <footer className="mt-16 bg-ink text-white/80">
      <div className="h-1.5 bg-primary" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <Image src="/brand/logo-icon.png" alt="" width={56} height={44} className="h-11 w-auto" />
            <span className="text-lg font-extrabold tracking-wide text-white">{s(settings, lang === "ar" ? "company_name_ar" : "company_name_en", dict.brand.name)}</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/70">{s(settings, "company_tagline_en", dict.brand.tagline)}</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{s(settings, "company_address_en")}</li>
            <li className="flex gap-2"><Phone className="size-4 shrink-0 text-primary" /><a href={`tel:${s(settings, "company_phone").replace(/\s/g, "")}`} dir="ltr">{s(settings, "company_phone")}</a></li>
            <li className="flex gap-2"><Mail className="size-4 shrink-0 text-primary" /><a href={`mailto:${s(settings, "company_email_sales")}`}>{s(settings, "company_email_sales")}</a></li>
          </ul>
        </div>
        {col(dict.footer.company, company)}
        {col(dict.footer.products, products)}
        {col(dict.footer.support, support)}
        {col(dict.footer.legal, legal)}
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {s(settings, "company_name_en", "KANZ CORNER EST.")}. {dict.footer.rights}
        {s(settings, "vat_number") && <span className="ms-3">VAT: {s(settings, "vat_number")}</span>}
        {s(settings, "company_cr_number") && <span className="ms-3">CR: {s(settings, "company_cr_number")}</span>}
      </div>
    </footer>
  );
}
