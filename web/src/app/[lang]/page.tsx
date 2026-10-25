import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Droplets, Factory, Flame, HardHat, ShieldCheck, Layers, Wrench, Languages } from "lucide-react";
import { isLocale, loc, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildTree, getBanners, getBestSellers, getCategories, getCategoryProductCounts, getFacets, getFlagged, getHomepageBrands, getHomepageSections, countPublishedProducts } from "@/lib/queries/catalog";
import { getQualityCerts } from "@/lib/queries/certs";
import { publicUrl } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import type { HomepageSection } from "@/lib/types";
import { HeroCarousel, type Slide } from "@/components/storefront/hero-carousel";
import { ProductGrid } from "@/components/storefront/product-card";
import { ProductImage } from "@/components/storefront/product-image";
import { Reveal } from "@/components/storefront/reveal";
import { FlangeDrawing } from "@/components/home/flange-drawing";
import { HeroSearch, type FacetOption } from "@/components/home/hero-search";
import { Counters } from "@/components/home/counters";
import { SectionRail } from "@/components/home/section-rail";
import { Magnetic } from "@/components/home/magnetic";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { CategoryIcon } from "@/components/home/category-icon";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "", absoluteTitle: true,
    title: l === "ar" ? "كنز كورنر — مورّد الأنابيب والوصلات والفلنجات والمحابس الصناعية في الخبر" : "KANZ CORNER EST. — industrial pipes, fittings, flanges & valves supplier in Al Khobar",
    description: l === "ar" ? "تورّد مؤسسة كنز كورنر الأنابيب والوصلات والوصلات المخددة والفلنجات والمحابس (الصمامات) الصناعية من الخبر إلى المملكة. اطلب عرض سعر للصلب الكربوني والستانلس ستيل والدوبلكس." : "KANZ CORNER EST. supplies industrial pipes, pipe fittings, grooved fittings, flanges and valves from Al Khobar to customers across Saudi Arabia. Request a quotation for carbon steel, stainless steel and duplex products." });
}

type Sec = Pick<HomepageSection, "type" | "title_en" | "title_ar" | "subtitle_en" | "subtitle_ar" | "config" | "id">;
const DEFAULT_ORDER: Sec[] = ["hero", "promo_banners", "quick_filters", "category_cards", "industries", "featured_products", "rfq_steps", "special_offers", "new_arrivals", "best_sellers", "brands", "certifications", "why_us", "recently_viewed", "rfq_cta"]
  .map((type) => ({ id: type, type, title_en: null, title_ar: null, subtitle_en: null, subtitle_ar: null, config: {} }));
/** Which categories each sector card links to (only those that exist are shown). */
const SECTOR_LINKS = [["pipe-fittings", "valves", "fasteners"], ["pipes", "flanges", "forged-fittings"], ["copper-grooved-fittings", "plastic-fittings", "valves"], ["flanges", "gaskets-gauges", "fasteners"]];
const SECTOR_ICONS = [HardHat, Flame, Droplets, Factory];
const WHY_ICONS = [Wrench, ShieldCheck, Layers, Languages];

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  if (!isLocale(l)) notFound();
  const lang: Locale = l; const ar = lang === "ar";
  const dict = getDictionary(lang); const hx = dict.home.hx;
  const [sections, cats, banners, secondary, strip, brands, productCount, facets, counts, certs] = await Promise.all([
    getHomepageSections(), getCategories(), getBanners("home_hero"), getBanners("home_secondary"), getBanners("home_strip"), getHomepageBrands(), countPublishedProducts(), getFacets(), getCategoryProductCounts(), getQualityCerts(),
  ]);
  const order = sections.length ? sections : DEFAULT_ORDER;
  const tree = buildTree(cats);
  const nm = (c: { name_en: string; name_ar: string | null }) => (ar && c.name_ar ? c.name_ar : c.name_en);
  const fmt = (n: number) => new Intl.NumberFormat(ar ? "ar-SA-u-nu-latn" : "en-US").format(n);
  const facet = (key: string): FacetOption[] => (facets.find((f) => f.key === key)?.values ?? []).map((v) => ({ value: v.value_en, label: ar && v.value_ar ? v.value_ar : v.value_en, n: v.n }));
  const bySlug = new Map(tree.map((c) => [c.slug, c]));
  const toSlide = (b: (typeof banners)[number]): Slide => ({
    id: b.id, desktop: publicUrl("banners", b.desktop_image_path), mobile: publicUrl("banners", b.mobile_image_path),
    title: loc(b, "title", lang), subtitle: loc(b, "subtitle", lang), cta: loc(b, "cta_label", lang),
    href: b.link_url ? (b.link_url.startsWith("/") ? `/${lang}${b.link_url}` : b.link_url) : null, alt: loc(b, "alt", lang) || loc(b, "title", lang),
  });

  let hero: React.ReactNode = null; let promo: React.ReactNode = null;
  const blocks: { id: string; label: string; numbered: boolean; node: (num: string) => React.ReactNode }[] = [];
  const add = (id: string, label: string, node: (num: string) => React.ReactNode, numbered = true) => blocks.push({ id, label, node, numbered });

  for (const sec of order) {
    const title = loc(sec, "title", lang); const subtitle = loc(sec, "subtitle", lang);
    switch (sec.type) {
      case "hero": {
        const counters = [{ value: tree.length, label: hx.counters.categories }, { value: productCount, label: hx.counters.products }, { value: facet("size").length, label: hx.counters.sizes }, { value: facet("standard").length, label: hx.counters.standards }].filter((c) => c.value > 0);
        hero = (
          <section key="hero" className="bg-drafting relative overflow-hidden border-b border-steel-300" aria-labelledby="hero-h">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-14 lg:pb-20 lg:pt-16">
              <div className="min-w-0">
                <p className="spec-label flex items-center gap-2 text-steel-600"><span className="inline-block h-px w-8 bg-primary" aria-hidden="true" />{hx.eyebrow}</p>
                <h1 id="hero-h" className="mt-5 max-w-[16ch] text-[2.5rem] font-semibold leading-[1.04] tracking-tight text-steel-900 sm:text-6xl lg:text-[4.25rem]">{hx.title}</h1>
                <div className="relative mt-5 flex max-w-xl items-center gap-3 text-primary" aria-hidden="true">
                  <span className="h-3 w-px bg-primary" /><span className="h-px flex-1 bg-primary/60" /><span className="spec-label whitespace-nowrap">{hx.dimension}</span><span className="h-px flex-1 bg-primary/60" /><span className="h-3 w-px bg-primary" />
                </div>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-steel-700">{hx.sub}</p>
                <div className="mt-8">
                  <HeroSearch lang={lang} categories={tree.map((c) => ({ slug: c.slug, name: nm(c) }))} facets={{ size: facet("size"), standard: facet("standard"), material: facet("material") }}
                    t={{ ...hx, placeholder: dict.search.placeholder, suggestions: dict.search.suggestions, viewAll: dict.search.viewAllResults, categoryWord: dict.common.category }} />
                </div>
                <div className="mt-8"><Counters items={counters} lang={lang} /></div>
              </div>
              <div className="relative min-w-0">
                <div className="relative border border-steel-300 bg-white/70 p-4 backdrop-blur-[1px] sm:p-6">
                  <FlangeDrawing labels={hx.drawing} />
                  <div className="mt-2 grid grid-cols-[1fr_auto_auto] border border-steel-300 text-steel-600" aria-hidden="true">
                    <span className="spec-label truncate border-e border-steel-300 px-3 py-2">{hx.drawing.title}</span>
                    <span className="spec-label border-e border-steel-300 px-3 py-2">{hx.drawing.scale}</span>
                    <span className="spec-label px-3 py-2">KC-001</span>
                  </div>
                  <span className="absolute -start-px -top-px size-3 border-s-2 border-t-2 border-primary" aria-hidden="true" /><span className="absolute -bottom-px -end-px size-3 border-b-2 border-e-2 border-primary" aria-hidden="true" />
                </div>
              </div>
            </div>
          </section>);
        break;
      }
      case "promo_banners":
        if (banners.length || secondary.length || strip.length) promo = (
          <div key="promo">
            {banners.length > 0 && <HeroCarousel slides={banners.map(toSlide)} lang={lang} />}
            {(strip.length > 0 || secondary.length > 0) && <div className="mx-auto mt-6 grid max-w-7xl gap-4 px-4 md:grid-cols-2">
              {strip.slice(0, 1).map((b) => <div key={b.id} className="md:col-span-2"><PromoTile s={toSlide(b)} wide /></div>)}
              {secondary.slice(0, 2).map((b) => <PromoTile key={b.id} s={toSlide(b)} />)}</div>}
          </div>);
        break;
      case "quick_filters": {
        const mats = facet("material"); const stds = facet("standard");
        const pipeKids = (bySlug.get("pipes")?.children ?? []).filter((c) => (counts.get(c.id) ?? 0) > 0);
        if (!mats.length && !stds.length && !pipeKids.length) break;
        const chip = "inline-flex min-h-10 items-center gap-2 border border-steel-300 bg-white px-3.5 text-sm font-medium text-steel-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
        add("s-filters", title || dict.home.hx.materials, (num) => (
          <Sheet num={num} id="s-filters" sheet={hx.sheet} title={title || (ar ? "تصفح حسب المادة والمواصفة" : "Browse by material & standard")} subtitle={subtitle}>
            <div className="grid gap-6 md:grid-cols-2">
              {(mats.length > 0 || pipeKids.length > 0) && <div><p className="spec-label mb-3 text-steel-500">{mats.length ? hx.materials : hx.byCategory}</p><ul className="flex flex-wrap gap-2">
                {mats.length ? mats.slice(0, 12).map((m) => <li key={m.value}><Link className={chip} href={`/${lang}/products?f.material=${encodeURIComponent(m.value)}`}>{m.label}<span className="font-mono text-xs text-steel-500">{m.n}</span></Link></li>)
                  : pipeKids.map((c) => <li key={c.id}><Link className={chip} href={`/${lang}/category/${c.slug}`}>{nm(c)}<span className="font-mono text-xs text-steel-500">{counts.get(c.id)}</span></Link></li>)}</ul></div>}
              {stds.length > 0 && <div><p className="spec-label mb-3 text-steel-500">{hx.standards}</p><ul className="flex flex-wrap gap-2">
                {stds.slice(0, 12).map((m) => <li key={m.value}><Link className={chip} href={`/${lang}/products?f.standard=${encodeURIComponent(m.value)}`}><span className="font-mono">{m.label}</span><span className="font-mono text-xs text-steel-500">{m.n}</span></Link></li>)}</ul></div>}
            </div>
          </Sheet>));
        break;
      }
      case "category_cards": {
        const featured = tree.filter((c) => c.is_featured); const list = featured.length ? featured : tree;
        if (!list.length) break;
        add("s-categories", title || dict.home.shopByCategory, (num) => (
          <Sheet num={num} id="s-categories" sheet={hx.sheet} title={title || dict.home.shopByCategory} subtitle={subtitle} href={`/${lang}/products`} more={dict.common.viewAll}>
            <ul className="grid grid-cols-2 border-s border-t border-steel-300 lg:grid-cols-3 [&>li]:border-b [&>li]:border-e [&>li]:border-steel-300">
              {list.map((c, i) => { const n = counts.get(c.id) ?? 0; const kids = c.children; return (
                <li key={c.id} className="group relative flex min-h-[11rem] flex-col bg-white p-3.5 transition-colors hover:bg-steel-50 sm:min-h-[15rem] sm:p-5">
                  <svg className="sheet-outline pointer-events-none absolute inset-0 size-full" aria-hidden="true" preserveAspectRatio="none"><rect x="1" y="1" pathLength={1} fill="none" stroke="var(--primary)" strokeWidth="2" style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }} /></svg>
                  <div className="flex items-start justify-between gap-3">
                    <span className="spec-label text-steel-500">{hx.sheet} {String(i + 1).padStart(2, "0")}</span>
                    <span className={`spec-label hidden sm:inline ${n ? "text-steel-800" : "text-steel-500"}`}>{n ? hx.products.replace("{n}", fmt(n)) : hx.onRequest}</span>
                  </div>
                  <CategoryIcon slug={c.slug} className="mt-3 size-10 text-steel-700 sm:mt-4 sm:size-14 transition-colors duration-300 group-hover:text-primary motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5" />
                  <h3 className="mt-3 text-[15px] font-semibold leading-snug sm:mt-4 sm:text-lg"><Link href={`/${lang}/category/${c.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{nm(c)}</Link></h3>
                  {n > 0 && <p className="spec-label mt-1 text-steel-600 sm:hidden">{hx.products.replace("{n}", fmt(n))}</p>}
                  {kids.length > 0 && <ul className="relative z-10 mt-3 hidden flex-wrap gap-1.5 sm:flex">
                    {kids.slice(0, 3).map((k) => <li key={k.id}><Link href={`/${lang}/category/${k.slug}`} className="inline-flex min-h-8 items-center border border-steel-200 bg-white px-2 text-xs text-steel-700 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{nm(k)}</Link></li>)}
                    {kids.length > 3 && <li className="inline-flex min-h-8 items-center px-1 font-mono text-xs text-steel-500">{hx.more.replace("{n}", String(kids.length - 3))}</li>}
                  </ul>}
                  <span className="spec-label mt-auto hidden items-center gap-1.5 pt-5 text-primary sm:flex">{hx.view}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" /></span>
                </li>); })}
            </ul>
          </Sheet>));
        break;
      }
      case "industries":
        add("s-industries", title || (ar ? "منتجات لقطاعك" : "Products for your sector"), (num) => (
          <Sheet num={num} id="s-industries" sheet={hx.sheet} title={title || (ar ? "منتجات لقطاعك" : "Products for your sector")} subtitle={subtitle || hx.industriesIntro}>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {hx.industries.map((it, i) => { const Icon = SECTOR_ICONS[i]; const links = SECTOR_LINKS[i].map((s) => bySlug.get(s)).filter(Boolean) as typeof tree; return (
                <li key={it.t} className="flex flex-col border border-steel-200 bg-white p-5">
                  <Icon className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-3 font-semibold">{it.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-steel-600">{it.d}</p>
                  <ul className="mt-auto space-y-1 pt-4">{links.map((c) => <li key={c.id}><Link href={`/${lang}/category/${c.slug}`} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-steel-800 hover:text-primary">{nm(c)}<ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" /></Link></li>)}</ul>
                </li>); })}
            </ul>
          </Sheet>));
        break;
      case "featured_products": case "new_arrivals": case "special_offers": {
        const flag = sec.type === "featured_products" ? "featured" : sec.type === "new_arrivals" ? "new" : "offer";
        const products = await getFlagged(flag, Number((sec.config as { limit?: number }).limit ?? 8));
        if (!products.length) break;
        const fb = sec.type === "featured_products" ? dict.home.featured : sec.type === "new_arrivals" ? dict.home.newArrivals : dict.home.specialOffers;
        add(`s-${flag}`, title || fb, (num) => <Sheet num={num} id={`s-${flag}`} sheet={hx.sheet} title={title || fb} subtitle={subtitle} href={`/${lang}/products?flag=${flag}`} more={dict.common.viewAll}><ProductGrid products={products} lang={lang} dict={dict} /></Sheet>);
        break;
      }
      case "best_sellers": {
        const products = await getBestSellers(8);
        if (!products.length) break;
        add("s-best", title || dict.home.bestSellers, (num) => <Sheet num={num} id="s-best" sheet={hx.sheet} title={title || dict.home.bestSellers} subtitle={subtitle}><ProductGrid products={products} lang={lang} dict={dict} /></Sheet>);
        break;
      }
      case "brands":
        if (!brands.length) break;
        add("s-brands", title || dict.home.brands, (num) => (
          <Sheet num={num} id="s-brands" sheet={hx.sheet} title={title || dict.home.brands} subtitle={subtitle}>
            <ul className="grid grid-cols-2 gap-px border border-steel-200 bg-steel-200 sm:grid-cols-3 lg:grid-cols-6">
              {brands.map((b) => <li key={b.id} className="flex h-24 items-center justify-center bg-white p-4">{b.logo_path ? <ProductImage path={b.logo_path} bucket="brand-logos" alt={b.name} className="h-full w-full grayscale transition hover:grayscale-0" /> : <span className="text-sm font-semibold text-steel-600">{b.name}</span>}</li>)}
            </ul>
          </Sheet>));
        break;
      case "certifications": {
        const withLogo = certs.filter((c) => c.logo_path);
        if (!withLogo.length) break;
        add("s-certs", title || (ar ? "الشهادات والاعتمادات" : "Certificates & approvals"), (num) => (
          <Sheet num={num} id="s-certs" sheet={hx.sheet} title={title || (ar ? "الشهادات والاعتمادات" : "Certificates & approvals")} subtitle={subtitle || hx.certsIntro} href={`/${lang}/quality`} more={hx.allCerts}>
            <ul className="flex flex-wrap gap-3">
              {withLogo.slice(0, 8).map((c) => { const href = c.document_path ? publicUrl("product-docs", c.document_path) : c.verification_url; const name = ar && c.name_ar ? c.name_ar : c.name_en;
                const img = <img src={publicUrl("site-icons", c.logo_path)!} alt={href ? "" : name} loading="lazy" className="max-h-full max-w-full object-contain" />;
                return <li key={c.id} className="w-[calc(50%-0.375rem)] sm:w-40">{href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name} (${dict.product.opensNew})`} className="flex aspect-[4/3] items-center justify-center border border-steel-200 bg-white p-4 transition-colors hover:border-steel-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{img}</a> : <div className="flex aspect-[4/3] items-center justify-center border border-steel-200 bg-white p-4">{img}</div>}</li>; })}
            </ul>
          </Sheet>));
        break;
      }
      case "why_us":
        add("s-why", title || dict.home.whyUs, (num) => (
          <Sheet num={num} id="s-why" sheet={hx.sheet} title={title || dict.home.whyUs} subtitle={subtitle}>
            <ol className="grid gap-px border border-steel-200 bg-steel-200 sm:grid-cols-2 xl:grid-cols-4">
              {dict.home.why.map((w, i) => { const Icon = WHY_ICONS[i % 4]; return (
                <li key={w.t} className="bg-white p-6"><div className="flex items-center justify-between"><Icon className="size-6 text-primary" aria-hidden="true" /><span className="font-mono text-xs text-steel-500" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span></div>
                  <h3 className="mt-4 font-semibold">{w.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-steel-600">{w.d}</p></li>); })}
            </ol>
          </Sheet>));
        break;
      case "rfq_steps":
        add("s-steps", title || (ar ? "اطلب عرض سعر في 3 خطوات" : "Request a quotation in 3 steps"), (num) => (
          <Sheet num={num} id="s-steps" sheet={hx.sheet} title={title || (ar ? "اطلب عرض سعر في 3 خطوات" : "Request a quotation in 3 steps")} subtitle={subtitle} dark>
            <ol className="relative grid gap-8 md:grid-cols-3">
              <span className="absolute inset-x-[16%] top-5 hidden h-px bg-white/25 md:block" aria-hidden="true" />
              {hx.steps.map((s, i) => (
                <li key={s.t} className="relative">
                  <span className="relative z-10 flex size-10 items-center justify-center border border-white/40 bg-steel-900 font-mono text-sm text-white">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{s.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.d}</p>
                </li>))}
            </ol>
            <div className="mt-8"><Link href={`/${lang}/rfq`} className="inline-flex min-h-12 items-center gap-2 bg-primary px-6 font-semibold text-white hover:bg-[#8e1e27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-steel-900">{dict.home.rfqCta}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link></div>
          </Sheet>));
        break;
      case "recently_viewed":
        add("s-recent", title || (ar ? "شوهدت مؤخراً" : "Recently viewed"), (num) => <RecentlyViewed key="recent" lang={lang} title={title || (ar ? "شوهدت مؤخراً" : "Recently viewed")} clear={hx.recentClear} note={hx.recentNote} num={`${num} — ${hx.sheet}`} />, false);
        break;
      case "rfq_cta":
        add("s-cta", title || dict.home.rfqTitle, () => (
          <section key="cta" id="s-cta" className="scroll-mt-40 py-12" aria-labelledby="cta-h">
            <Reveal>
              <div className="bg-drafting-dark relative flex flex-col items-start gap-6 overflow-hidden border border-steel-700 px-6 py-12 text-white md:flex-row md:items-center md:justify-between md:px-12">
                <div className="max-w-2xl"><p className="spec-label text-white/60">KANZ CORNER EST.</p><h2 id="cta-h" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title || dict.home.rfqTitle}</h2><p className="mt-3 text-white/75">{subtitle || dict.home.rfqText}</p></div>
                <Magnetic><Link href={`/${lang}/rfq`} className="inline-flex min-h-14 items-center gap-3 bg-primary px-8 text-lg font-semibold text-white shadow-[6px_6px_0_0_rgba(255,255,255,0.12)] hover:bg-[#8e1e27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-steel-900">{dict.home.rfqCta}<ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" /></Link></Magnetic>
              </div>
            </Reveal>
          </section>), false);
        break;
    }
  }

  let n = 0;
  const numbered = blocks.map((b) => ({ ...b, num: String(++n).padStart(2, "0") }));
  return (
    <>
      {hero ?? <h1 className="sr-only">{hx.title}</h1>}
      {promo}
      <div className="mx-auto max-w-7xl px-4 xl:grid xl:grid-cols-[10.5rem_minmax(0,1fr)] xl:gap-10">
        <SectionRail label={hx.onThisPage} items={numbered.filter((b) => b.numbered).map((b) => ({ id: b.id, num: b.num, label: b.label }))} />
        <div className="min-w-0">
          {numbered.map((b) => <Fragment key={b.id}>{b.node(b.num)}</Fragment>)}
          {productCount === 0 && <p className="mx-auto max-w-3xl py-6 text-center text-steel-600">{dict.home.emptyCatalogue}</p>}
        </div>
      </div>
    </>
  );
}

/** A numbered "drawing sheet" section: sheet number, title, dimension-style rule, optional link. */
function Sheet({ id, num, sheet, title, subtitle, href, more, dark, children }: { id: string; num: string; sheet: string; title: string; subtitle?: string; href?: string; more?: string; dark?: boolean; children: React.ReactNode }) {
  const body = (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className={`spec-label ${dark ? "text-white/60" : "text-steel-500"}`}>{num} — {sheet}</p>
          <h2 id={`${id}-h`} className={`mt-2 text-2xl font-semibold tracking-tight sm:text-[2.1rem] sm:leading-tight ${dark ? "text-white" : "text-steel-900"}`}>{title}</h2>
          {subtitle && <p className={`mt-2 leading-relaxed ${dark ? "text-white/70" : "text-steel-600"}`}>{subtitle}</p>}
        </div>
        {href && more && <Link href={href} className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold ${dark ? "text-white" : "text-primary"} hover:underline`}>{more}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>}
      </div>
      {children}
    </>);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-40 py-12 sm:py-14">
      <div className="mb-8 flex items-center gap-2" aria-hidden="true"><span className="h-3 w-px bg-steel-400" /><span className="h-px flex-1 bg-steel-300" /><span className="h-3 w-px bg-steel-400" /></div>
      <Reveal>{dark ? <div className="bg-drafting-dark border border-steel-700 p-6 sm:p-10">{body}</div> : body}</Reveal>
    </section>
  );
}

function PromoTile({ s, wide }: { s: Slide; wide?: boolean }) {
  const inner = (
    <picture>
      {s.mobile && <source media="(max-width: 767px)" srcSet={s.mobile} />}
      <img src={s.desktop ?? s.mobile ?? ""} alt={s.alt} loading="lazy" className={`w-full object-cover ${wide ? "h-28 sm:h-36" : "h-40 sm:h-52"}`} />
    </picture>
  );
  return s.href ? <Link href={s.href} className="block overflow-hidden border border-steel-200">{inner}</Link> : inner;
}
