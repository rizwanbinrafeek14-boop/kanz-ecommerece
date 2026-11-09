import Link from "next/link";
import { headerDict } from "@/lib/i18n/header-dict";
import { TrackedLink } from "./tracked-link";
import Image from "next/image";
import { Suspense } from "react";
import { Phone, Mail } from "lucide-react";
import { buildTree, getCategories, getAnnouncements } from "@/lib/queries/catalog";
import { getSettings, s } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loc, type Locale } from "@/lib/i18n/config";
import { publicUrl } from "@/lib/format";
import { SearchBox } from "./search-box";
import { LangSwitch } from "./lang-switch";
import { AccountMenu } from "./account-menu";
import { CartButtons } from "./cart-button";
import { MobileMenu, type MenuNode } from "./mobile-menu";
import { CategoryBar, CategoryMegaMenu, type NavCategory } from "./category-nav";
import { SocialLinks } from "@/components/social-icon";
import { getContact } from "@/lib/queries/contact";

type TreeLike = { id: string; slug: string; name_en: string; name_ar: string | null; children: TreeLike[] };
const menuTree = (t: TreeLike[]): MenuNode[] => t.map((c) => ({ id: c.id, slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, children: menuTree(c.children) }));

export async function Header({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang); const hd = headerDict(dict);
  const [cats, settings, announcements, { links }] = await Promise.all([getCategories(), getSettings(), getAnnouncements(), getContact()]);
  const tree = buildTree(cats);
  const nm = (c: { name_en: string; name_ar: string | null }) => (lang === "ar" && c.name_ar ? c.name_ar : c.name_en);
  const announcement = announcements[0];
  const nav: NavCategory[] = tree.map((c) => ({ id: c.id, href: `/${lang}/category/${c.slug}`, name: nm(c), image: publicUrl("category-images", c.image_path),
    children: c.children.map((ch) => ({ id: ch.id, href: `/${lang}/category/${ch.slug}`, name: nm(ch) })) }));

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
            <TrackedLink event="phone_click" href={`tel:${s(settings, "company_phone").replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-white"><Phone className="size-3.5" /><span dir="ltr">{s(settings, "company_phone")}</span></TrackedLink>
            <a href={`mailto:${s(settings, "company_email_sales")}`} className="flex items-center gap-1.5 hover:text-white"><Mail className="size-3.5" />{s(settings, "company_email_sales")}</a>
          </div>
          <div className="flex items-center gap-2"><SocialLinks links={links.filter((l) => l.show_header)} size={16} className="gap-0" itemClassName="size-8 sm:size-8 hover:bg-white/10" /><Suspense fallback={null}><LangSwitch lang={lang} label={dict.common.language} /></Suspense></div>
        </div>
      </div>

      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:gap-6">
          <MobileMenu tree={menuTree(tree)} lang={lang} dict={{ common: { viewAll: dict.common.viewAll }, nav: { about: dict.nav.about, categories: dict.nav.categories, contact: dict.nav.contact, followUs: dict.nav.followUs, quality: dict.nav.quality, rfq: dict.nav.rfq } }} social={<SocialLinks links={links.filter((l) => l.show_mobile_menu)} size={20} itemClassName="bg-ink text-white hover:bg-primary" />} />
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2.5" aria-label={dict.brand.name}>
            <Image src="/brand/logo-icon.png" alt="" width={48} height={38} priority className="h-9 w-auto" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-base font-extrabold tracking-wide">KANZ CORNER</span>
              <span className="block text-[11px] tracking-[0.3em] text-white/75">{lang === "ar" ? "للتجارة" : "TRADING EST."}</span>
            </span>
          </Link>
          <SearchBox lang={lang} dict={hd} className="hidden flex-1 md:block" />
          <div className="ms-auto flex items-center gap-3 sm:gap-4 md:ms-0">
            <div className="lg:hidden"><Suspense fallback={null}><LangSwitch lang={lang} label={dict.common.language} /></Suspense></div>
            <AccountMenu lang={lang} dict={hd} />
            <CartButtons lang={lang} dict={hd} />
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden"><SearchBox lang={lang} dict={hd} /></div>
      </div>

      {/* Category bar + mega menu (CSS-only: opens on hover and keyboard focus) */}
      <nav className="hidden border-b bg-white lg:block" aria-label="Categories">
        <div className="mx-auto flex max-w-7xl items-stretch px-4">
          <CategoryMegaMenu label={dict.nav.categories} viewAll={dict.common.viewAll} tree={nav} />
          <CategoryBar more={dict.nav.more} tree={nav} />
          <Link href={`/${lang}/quality`} className="mx-1 flex items-center whitespace-nowrap px-3 text-sm font-medium hover:text-primary">{dict.nav.quality}</Link>
          <Link href={`/${lang}/rfq`} className="my-2 flex items-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">{dict.nav.rfq}</Link>
        </div>
      </nav>
    </header>
  );
}
