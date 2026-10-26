import Link from "next/link";
import { SlidersHorizontal, ChevronRight, Check, X } from "lucide-react";
import { getFacets, searchProducts, buildTree, getCategories, getBanners } from "@/lib/queries/catalog";
import { loc, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Category } from "@/lib/types";
import { publicUrl } from "@/lib/format";
import { ProductGrid } from "./product-card";
import { SearchLogger } from "./search-logger";

export type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZE = 24;

interface State { q?: string; sort?: string; page: number; avail?: string; flag?: string; f: Record<string, string[]> }

function parse(sp: RawParams): State {
  const f: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("f.")) { const val = one(v); if (val) f[k.slice(2)] = val.split("||").filter(Boolean); }
  }
  return { q: one(sp.q)?.slice(0, 100), sort: one(sp.sort), page: Math.max(1, Number(one(sp.page)) || 1), avail: one(sp.avail), flag: one(sp.flag), f };
}

function qs(s: State): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.sort && s.sort !== "newest") p.set("sort", s.sort);
  if (s.avail) p.set("avail", s.avail);
  if (s.flag) p.set("flag", s.flag);
  if (s.page > 1) p.set("page", String(s.page));
  for (const [k, v] of Object.entries(s.f)) if (v.length) p.set(`f.${k}`, v.join("||"));
  const str = p.toString();
  return str ? `?${str}` : "";
}

export async function Listing({ lang, dict, category, brand, sp, basePath }: { lang: Locale; dict: Dictionary; category?: Category | null; brand?: { id: string; name: string; name_ar: string | null; description?: string | null } | null; sp: RawParams; basePath: string }) {
  const st = parse(sp);
  if (brand) delete st.f.brand;   // a brand page is already limited to its brand
  const [{ products, total }, allFacets, cats, banners] = await Promise.all([
    searchProducts({ q: st.q, category: category?.id, filters: brand ? { ...st.f, brand: [brand.name] } : st.f, availability: st.avail, flag: st.flag, sort: st.sort, page: st.page, pageSize: PAGE_SIZE }),
    getFacets(st.q, category?.id, brand?.id), getCategories(), category ? getBanners("category_top", category.id) : Promise.resolve([]),
  ]);
  // nothing for the exact words: try the same words without sizes / classes / codes, so the customer sees the product type at least
  const looser = !total && st.q ? st.q.split(/\s+/).filter((w) => !/\d/.test(w)).join(" ").trim() : "";
  const closest = looser && looser !== st.q ? (await searchProducts({ q: looser, category: category?.id, pageSize: 8 })).products : [];
  const facets = brand ? allFacets.filter((f) => f.key !== "brand") : allFacets;
  const label = (v: { label_en: string; value_ar: string | null }) => (lang === "ar" && v.value_ar ? v.value_ar : v.label_en);
  const tree = buildTree(cats);
  const children = category ? cats.filter((c) => c.parent_id === category.id) : [];
  const parent = category?.parent_id ? cats.find((c) => c.id === category.parent_id) : null;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Partial<State>) => `${basePath}${qs({ ...st, page: 1, ...patch })}`;
  const toggle = (key: string, val: string) => {
    const cur = st.f[key] ?? [];
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    return href({ f: { ...st.f, [key]: next } });
  };
  const activeCount = Object.values(st.f).reduce((n, v) => n + v.length, 0) + (st.avail ? 1 : 0);
  const availLabel: Record<string, string> = { in_stock: dict.filters.inStockOnly, priced: dict.filters.priced, quote_only: dict.filters.quoteOnly };
  const chips: { key: string; label: string; href: string }[] = [];
  if (st.q) chips.push({ key: "q", label: `“${st.q}”`, href: href({ q: undefined }) });
  if (st.avail && availLabel[st.avail]) chips.push({ key: "avail", label: availLabel[st.avail], href: href({ avail: undefined }) });
  for (const [k, vals] of Object.entries(st.f)) {
    const fc = facets.find((x) => x.key === k);
    for (const val of vals) {
      const fv = fc?.values.find((x) => x.value_en === val);
      chips.push({ key: `${k}:${val}`, label: `${fc ? (lang === "ar" && fc.name_ar ? fc.name_ar : fc.name_en) : k}: ${fv ? label(fv) : val}`, href: href({ f: { ...st.f, [k]: vals.filter((x) => x !== val) } }) });
    }
  }
  const clearAll = `${basePath}${qs({ page: 1, f: {}, sort: st.sort })}`;
  const title = category ? loc(category, "name", lang) : brand ? ((lang === "ar" && brand.name_ar) || brand.name) : st.q ? `“${st.q}”` : dict.nav.products;

  const sidebar = (
    <div className="space-y-6">
      {!category && tree.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">{dict.common.category}</h3>
          <ul className="space-y-1 text-sm">{tree.map((c) => <li key={c.id}><Link href={`/${lang}/category/${c.slug}`} className="text-muted-foreground hover:text-primary">{loc(c, "name", lang)}</Link></li>)}</ul>
        </div>
      )}
      {facets.map((fc) => (
        <div key={fc.key} data-facet={fc.key}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">{lang === "ar" && fc.name_ar ? fc.name_ar : fc.name_en}</h3>
          <ul className="max-h-60 space-y-1 overflow-y-auto pe-1 text-sm">
            {fc.values.map((v) => {
              const on = (st.f[fc.key] ?? []).includes(v.value_en);
              return (
                <li key={v.value_en}><Link href={toggle(fc.key, v.value_en)} className="flex min-h-8 items-center gap-2 hover:text-primary" rel="nofollow" data-value={v.value_en}>
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-white" : "border-input"}`}>{on && <Check className="size-3" />}</span>
                  <span className="flex-1 truncate" title={fc.key === "material" ? `${v.value_en} · ${v.label_en}` : undefined}>{fc.key === "material" ? <><span className="font-mono text-xs font-semibold">{v.value_en}</span> {label(v)}</> : label(v)}</span><span className="text-xs text-muted-foreground">{v.n}</span>
                </Link></li>
              );
            })}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">{dict.filters.availability}</h3>
        <ul className="space-y-1 text-sm">
          {([["in_stock", dict.filters.inStockOnly], ["priced", dict.filters.priced], ["quote_only", dict.filters.quoteOnly]] as const).map(([v, label]) => (
            <li key={v}><Link href={href({ avail: st.avail === v ? undefined : v })} className="flex items-center gap-2 hover:text-primary">
              <span className={`flex size-4 items-center justify-center rounded border ${st.avail === v ? "border-primary bg-primary text-white" : "border-input"}`}>{st.avail === v && <Check className="size-3" />}</span>{label}
            </Link></li>
          ))}
        </ul>
      </div>
      {activeCount > 0 && <Link href={`${basePath}${qs({ q: st.q, page: 1, f: {} })}`} className="inline-block text-sm font-medium text-primary hover:underline">{dict.filters.clear}</Link>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/${lang}`} className="hover:text-primary">{dict.common.home}</Link><ChevronRight className="size-3.5 rtl:rotate-180" />
        <Link href={`/${lang}/products`} className="hover:text-primary">{dict.nav.products}</Link>
        {parent && <><ChevronRight className="size-3.5 rtl:rotate-180" /><Link href={`/${lang}/category/${parent.slug}`} className="hover:text-primary">{loc(parent, "name", lang)}</Link></>}
        {category && <><ChevronRight className="size-3.5 rtl:rotate-180" /><span className="text-foreground">{loc(category, "name", lang)}</span></>}
      </nav>

      {banners.slice(0, 1).map((b) => (
        <div key={b.id} className="mb-6 overflow-hidden rounded-xl">
          {b.link_url ? <Link href={b.link_url}><img src={publicUrl("banners", b.desktop_image_path) ?? ""} alt={loc(b, "alt", lang)} className="w-full object-cover" /></Link>
            : <img src={publicUrl("banners", b.desktop_image_path) ?? ""} alt={loc(b, "alt", lang)} className="w-full object-cover" />}
        </div>
      ))}

      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {category && loc(category, "description", lang) && <p className="mt-2 max-w-3xl text-muted-foreground">{loc(category, "description", lang)}</p>}

      {children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {children.map((c) => <Link key={c.id} href={`/${lang}/category/${c.slug}`} className="rounded-full border px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary">{loc(c, "name", lang)}</Link>)}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">{sidebar}</aside>
        <details className="rounded-lg border p-3 lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" />{dict.filters.title}{activeCount > 0 && ` (${activeCount})`}</summary>
          <div className="mt-4">{sidebar}</div>
        </details>

        <div>
          <div className="mb-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground" aria-live="polite">{total} {dict.filters.results}</p>
              <nav aria-label={dict.common.sortBy} className="flex flex-wrap items-center gap-1.5">
                <span className="me-1 font-medium">{dict.common.sortBy}:</span>
                {([["newest", st.q ? dict.filters.sort.relevance : (lang === "ar" ? "الأحدث" : "Newest")], ["name_asc", dict.filters.sort.nameAsc], ["price_low", dict.filters.sort.priceLow], ["popular", dict.filters.sort.popular]] as const).map(([v, label]) => {
                  const on = (st.sort ?? "newest") === v;
                  return <Link key={v} href={href({ sort: v })} rel="nofollow" aria-current={on ? "true" : undefined}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "border-ink bg-ink text-white" : "bg-background hover:border-primary hover:text-primary"}`}>{on && <Check className="size-3.5" aria-hidden="true" />}{label}</Link>;
                })}
              </nav>
            </div>
            {chips.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2" aria-label={dict.filters.title}>
                {chips.map((c) => (
                  <li key={c.key}><Link href={c.href} rel="nofollow" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 font-medium hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {c.label}<X className="size-3.5" aria-hidden="true" /><span className="sr-only">{dict.common.remove}</span></Link></li>))}
                <li><Link href={clearAll} rel="nofollow" className="inline-flex min-h-10 items-center rounded-full px-3.5 py-1.5 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{dict.filters.clear}</Link></li>
              </ul>)}
          </div>
          {st.q && st.page === 1 && <SearchLogger query={st.q} results={total} lang={lang} />}
          {products.length ? <ProductGrid products={products} lang={lang} dict={dict} activeMaterials={st.f.material} /> : (
            <div className="space-y-6" data-empty-results>
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="font-medium">{dict.common.noResults}</p>
                {st.q && <p className="mt-2 text-sm text-muted-foreground">{lang === "ar" ? `لم نجد مطابقة تامة لـ “${st.q}”. يمكنك إضافته إلى طلب عرض السعر كما هو وسنقترح الصنف المناسب.` : `No exact match for “${st.q}”. Add it to a quotation request as written and we will propose the right item.`}</p>}
                <Link href={`/${lang}/rfq`} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-soft">{dict.nav.rfq} →</Link>
              </div>
              {closest.length > 0 && <section aria-labelledby="closest-h"><h2 id="closest-h" className="mb-3 text-lg font-semibold">{lang === "ar" ? `أقرب المنتجات لـ “${looser}”` : `Closest products for “${looser}”`}</h2>
                <ProductGrid products={closest} lang={lang} dict={dict} /></section>}
            </div>
          )}
          {category && loc(category, "buying_guide", lang) && st.page === 1 && !Object.keys(st.f).length && !st.q && (
            <section className="mt-12 rounded-xl border bg-muted/40 p-6" aria-labelledby="guide-h">
              <h2 id="guide-h" className="mb-3 text-xl font-bold">{lang === "ar" ? `دليل الشراء: ${loc(category, "name", lang)}` : `Buying guide: ${loc(category, "name", lang)}`}</h2>
              <div className="max-w-3xl space-y-3 leading-relaxed text-muted-foreground">{loc(category, "buying_guide", lang).split(/\n\s*\n/).map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
              <p className="mt-4 text-sm"><Link href={`/${lang}/rfq`} className="font-semibold text-primary hover:underline">{dict.nav.rfq} →</Link></p>
            </section>)}
          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, st.page - 4), st.page + 3).map((n) => (
                <Link key={n} href={href({ page: n })} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === st.page ? "border-primary bg-primary text-white" : "hover:bg-accent"}`}>{n}</Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
