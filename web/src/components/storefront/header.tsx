import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Phone, Mail, ChevronDown } from "lucide-react";
import { buildTree, getCategories, getAnnouncements } from "@/lib/queries/catalog";
import { getSettings, s } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loc, type Locale } from "@/lib/i18n/config";
import { publicUrl } from "@/lib/format";
import { SearchBox } from "./search-box";
import { LangSwitch } from "./lang-switch";
import { AccountMenu } from "./account-menu";
import { CartButtons } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { SocialLinks } from "@/components/social-icon";
import { getContact } from "@/lib/queries/contact";

export async function Header({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang);
  const [cats, settings, announcements, { links }] = await Promise.all([getCategories(), getSettings(), getAnnouncements(), getContact()]);
  const tree = buildTree(cats);
  const nm = (c: { name_en: string; name_ar: string | null }) => (lang === "ar" && c.name_ar ? c.name_ar : c.name_en);
  const announcement = announcements[0];

  return (
    <header className="sticky top-0 z-40 shadow-md">
      {announcement && (
        <div className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-white">
          {announcement.link_url ? <Link href={announcement.link_url} className="hover:underline">{loc(announcement, "text", lang)}</Link> : loc(announcement, "text", lang)}
        </div>
      )}
      <div className="hidden bg-ink-soft text-xs text-white/80 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-5">
            <a href={`tel:${s(settings, "company_phone").replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-white"><Phone className="size-3.5" /><span dir="ltr">{s(settings, "company_phone")}</span></a>
            <a href={`mailto:${s(settings, "company_email_sales")}`} className="flex items-center gap-1.5 hover:text-white"><Mail className="size-3.5" />{s(settings, "company_email_sales")}</a>
          </div>
          <div className="flex items-center gap-2"><SocialLinks links={links.filter((l) => l.show_header)} size={16} className="gap-0" itemClassName="size-8 sm:size-8 hover:bg-white/10" /><Suspense fallback={null}><LangSwitch lang={lang} label={dict.common.language} /></Suspense></div>
        </div>
      </div>

      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:gap-6">
          <MobileMenu tree={tree} lang={lang} dict={dict} social={<SocialLinks links={links.filter((l) => l.show_mobile_menu)} size={20} itemClassName="bg-ink text-white hover:bg-primary" />} />
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2.5" aria-label={dict.brand.name}>
            <Image src="/brand/logo-icon.png" alt="" width={48} height={38} priority className="h-9 w-auto" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-base font-extrabold tracking-wide">KANZ CORNER</span>
              <span className="block text-[11px] tracking-[0.3em] text-white/75">{lang === "ar" ? "للتجارة" : "TRADING EST."}</span>
            </span>
          </Link>
          <SearchBox lang={lang} dict={dict} className="hidden flex-1 md:block" />
          <div className="ms-auto flex items-center gap-3 sm:gap-4 md:ms-0">
            <div className="lg:hidden"><Suspense fallback={null}><LangSwitch lang={lang} label={dict.common.language} /></Suspense></div>
            <AccountMenu lang={lang} dict={dict} />
            <CartButtons lang={lang} dict={dict} />
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden"><SearchBox lang={lang} dict={dict} /></div>
      </div>

      {/* Category bar + mega menu (CSS-only: opens on hover and keyboard focus) */}
      <nav className="hidden border-b bg-white lg:block" aria-label="Categories">
        <div className="mx-auto flex max-w-7xl items-stretch px-4">
          <div className="group relative">
            <button className="flex h-12 items-center gap-2 bg-primary px-5 text-sm font-semibold text-white">
              {dict.nav.categories} <ChevronDown className="size-4" />
            </button>
            <div className="invisible absolute start-0 top-full z-50 w-[min(1100px,92vw)] border bg-white opacity-0 shadow-2xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="grid max-h-[70vh] grid-cols-3 gap-x-6 gap-y-5 overflow-y-auto p-6 xl:grid-cols-4">
                {tree.map((c) => (
                  <div key={c.id}>
                    <Link href={`/${lang}/category/${c.slug}`} className="mb-1.5 flex items-center gap-2 font-semibold text-ink hover:text-primary">
                      {c.image_path && <Image src={publicUrl("category-images", c.image_path)!} alt="" width={28} height={28} className="size-7 rounded object-contain" unoptimized />}
                      {nm(c)}
                    </Link>
                    <ul className="space-y-0.5 border-s ps-3">
                      {c.children.slice(0, 8).map((ch) => (
                        <li key={ch.id}><Link href={`/${lang}/category/${ch.slug}`} className="text-sm text-muted-foreground hover:text-primary">{nm(ch)}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ul className="flex flex-1 items-center gap-1 overflow-hidden ps-3 text-sm font-medium">
            {tree.slice(0, 6).map((c) => (
              <li key={c.id}><Link href={`/${lang}/category/${c.slug}`} className="block whitespace-nowrap px-3 py-3.5 hover:text-primary">{nm(c)}</Link></li>
            ))}
          </ul>
          <Link href={`/${lang}/quality`} className="mx-1 flex items-center whitespace-nowrap px-3 text-sm font-medium hover:text-primary">{dict.nav.quality}</Link>
          <Link href={`/${lang}/rfq`} className="my-2 flex items-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">{dict.nav.rfq}</Link>
        </div>
      </nav>
    </header>
  );
}
