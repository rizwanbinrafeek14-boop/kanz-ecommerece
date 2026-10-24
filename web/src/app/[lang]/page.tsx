import Link from "next/link";
import { ArrowRight, Wrench, ShieldCheck, Layers, Headset } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale, loc, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { buildTree, getBanners, getBestSellers, getCategories, getFlagged, getHomepageBrands, getHomepageSections, countPublishedProducts } from "@/lib/queries/catalog";
import { publicUrl } from "@/lib/format";
import type { HomepageSection } from "@/lib/types";
import { HeroCarousel, type Slide } from "@/components/storefront/hero-carousel";
import { ProductGrid } from "@/components/storefront/product-card";
import { ProductImage } from "@/components/storefront/product-image";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/storefront/reveal";

export const revalidate = 60;

const DEFAULT_ORDER: Pick<HomepageSection, "type" | "title_en" | "title_ar" | "subtitle_en" | "subtitle_ar" | "config" | "id">[] =
  ["hero", "category_cards", "featured_products", "special_offers", "new_arrivals", "best_sellers", "brands", "why_us", "rfq_cta"]
    .map((type) => ({ id: type, type, title_en: null, title_ar: null, subtitle_en: null, subtitle_ar: null, config: {} }));

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLocale(l)) notFound();
  const lang: Locale = l;
  const dict = getDictionary(lang);
  const [sections, cats, banners, secondary, strip, brands, productCount] = await Promise.all([
    getHomepageSections(), getCategories(), getBanners("home_hero"), getBanners("home_secondary"), getBanners("home_strip"), getHomepageBrands(), countPublishedProducts(),
  ]);
  const order = sections.length ? sections : DEFAULT_ORDER;
  const tree = buildTree(cats);

  const toSlide = (b: (typeof banners)[number]): Slide => ({
    id: b.id, desktop: publicUrl("banners", b.desktop_image_path), mobile: publicUrl("banners", b.mobile_image_path),
    title: loc(b, "title", lang), subtitle: loc(b, "subtitle", lang), cta: loc(b, "cta_label", lang),
    href: b.link_url ? (b.link_url.startsWith("/") ? `/${lang}${b.link_url}` : b.link_url) : null, alt: loc(b, "alt", lang) || loc(b, "title", lang),
  });

  const out: React.ReactNode[] = [];
  for (const sec of order) {
    const title = loc(sec, "title", lang);
    const subtitle = loc(sec, "subtitle", lang);
    switch (sec.type) {
      case "hero":
        out.push(banners.length
          ? <HeroCarousel key={sec.id} slides={banners.map(toSlide)} lang={lang} />
          : <DefaultHero key={sec.id} lang={lang} dict={dict} />);
        break;
      case "category_cards": {
        const featured = tree.filter((c) => c.is_featured);
        const list = featured.length ? featured : tree;
        if (!list.length) break;
        out.push(
          <Section key={sec.id} title={title || dict.home.shopByCategory} subtitle={subtitle}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((c) => (
                <Link key={c.id} href={`/${lang}/category/${c.slug}`} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-center shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-xl focus-visible:outline-offset-4 motion-reduce:transform-none">
                  <ProductImage path={c.image_path} bucket="category-images" alt={loc(c, "name", lang)} className="aspect-[4/3] w-full bg-gradient-to-b from-white to-muted p-5 transition duration-500 group-hover:scale-105" />
                  <div className="flex min-h-14 items-center justify-center gap-2 bg-ink px-3 py-3 text-sm font-semibold text-white transition-colors group-hover:bg-primary">{loc(c, "name", lang)}<ArrowRight className="size-4 shrink-0 opacity-70 rtl:rotate-180" aria-hidden="true" /></div>
                </Link>
              ))}
            </div>
          </Section>);
        if (secondary.length) out.push(<div key={sec.id + "-sec"} className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 md:grid-cols-2">{secondary.slice(0, 2).map((b) => <PromoTile key={b.id} s={toSlide(b)} />)}</div>);
        break;
      }
      case "featured_products": case "new_arrivals": case "special_offers": {
        const flag = sec.type === "featured_products" ? "featured" : sec.type === "new_arrivals" ? "new" : "offer";
        const products = await getFlagged(flag, Number((sec.config as { limit?: number }).limit ?? 8));
        if (!products.length) break;
        const fallback = sec.type === "featured_products" ? dict.home.featured : sec.type === "new_arrivals" ? dict.home.newArrivals : dict.home.specialOffers;
        out.push(<Section key={sec.id} title={title || fallback} subtitle={subtitle} href={`/${lang}/products?flag=${flag}`} more={dict.common.viewAll}><ProductGrid products={products} lang={lang} dict={dict} /></Section>);
        break;
      }
      case "best_sellers": {
        const products = await getBestSellers(8);
        if (!products.length) break;   // only shown once real orders exist
        out.push(<Section key={sec.id} title={title || dict.home.bestSellers} subtitle={subtitle}><ProductGrid products={products} lang={lang} dict={dict} /></Section>);
        break;
      }
      case "brands":
        if (!brands.length) break;
        out.push(
          <Section key={sec.id} title={title || dict.home.brands} subtitle={subtitle}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {brands.map((b) => <div key={b.id} className="flex h-20 w-40 items-center justify-center rounded-lg border bg-white p-3">
                {b.logo_path ? <ProductImage path={b.logo_path} bucket="brand-logos" alt={b.name} className="h-full w-full" /> : <span className="text-sm font-semibold text-muted-foreground">{b.name}</span>}
              </div>)}
            </div>
          </Section>);
        break;
      case "why_us": {
        const icons = [Wrench, ShieldCheck, Layers, Headset];
        out.push(
          <Section key={sec.id} title={title || dict.home.whyUs} subtitle={subtitle}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dict.home.why.map((w, n) => { const Icon = icons[n % 4]; return (
                <div key={w.t} className="rounded-xl border bg-card p-6">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-6" /></span>
                  <h3 className="font-semibold">{w.t}</h3><p className="mt-1.5 text-sm text-muted-foreground">{w.d}</p>
                </div>); })}
            </div>
          </Section>);
        break;
      }
      case "rfq_cta":
        out.push(
          <section key={sec.id} className="mx-auto mt-20 max-w-7xl px-4">
            <div className="bg-steel flex flex-col items-center gap-5 rounded-3xl px-6 py-14 md:px-12 text-center text-white md:flex-row md:justify-between md:text-start">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold sm:text-3xl">{title || dict.home.rfqTitle}</h2>
                <p className="mt-2 text-white/75">{subtitle || dict.home.rfqText}</p>
              </div>
              <Button asChild size="lg"><Link href={`/${lang}/rfq`}>{dict.home.rfqCta} <ArrowRight className="size-4 rtl:rotate-180" /></Link></Button>
            </div>
          </section>);
        break;
    }
  }
  if (strip.length) out.splice(1, 0, <div key="strip" className="mx-auto mt-6 max-w-7xl px-4"><PromoTile s={toSlide(strip[0])} wide /></div>);

  return (
    <>
      {out}
      {productCount === 0 && (
        <p className="mx-auto mt-10 max-w-3xl px-4 text-center text-muted-foreground">{dict.home.emptyCatalogue}</p>
      )}
    </>
  );
}

function Section({ title, subtitle, href, more, children }: { title: string; subtitle?: string; href?: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:mt-20">
      <Reveal>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="mb-3 block h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{title}</h2>
            {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground sm:text-lg">{subtitle}</p>}
          </div>
          {href && more && <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 font-semibold text-primary hover:underline">{more}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>}
        </div>
        {children}
      </Reveal>
    </section>
  );
}

function PromoTile({ s, wide }: { s: Slide; wide?: boolean }) {
  const inner = (
    <picture>
      {s.mobile && <source media="(max-width: 767px)" srcSet={s.mobile} />}
      <img src={s.desktop ?? s.mobile ?? ""} alt={s.alt} loading="lazy" className={`w-full rounded-xl object-cover ${wide ? "h-28 sm:h-36" : "h-40 sm:h-52"}`} />
    </picture>
  );
  return s.href ? <Link href={s.href} className="block overflow-hidden rounded-xl">{inner}</Link> : inner;
}

function DefaultHero({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="bg-steel relative isolate overflow-hidden text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span dir="ltr" className="mb-4 inline-block rounded bg-primary px-3 py-1 text-xs font-bold tracking-widest">KANZ CORNER EST.</span>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">{dict.home.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/80 sm:text-xl">{dict.home.heroSub}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href={`/${lang}/products`}>{dict.home.heroCta}</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href={`/${lang}/rfq`}>{dict.home.heroCta2}</Link></Button>
          </div>
        </div>
        <div className="relative hidden justify-center md:flex">
          <div className="absolute -inset-6 rounded-full bg-primary/20 blur-3xl" />
          <img src="/brand/logo-icon.png" alt="" className="relative w-72 drop-shadow-2xl lg:w-96" />
        </div>
      </div>
      <div className="h-1.5 bg-primary" />
    </section>
  );
}
