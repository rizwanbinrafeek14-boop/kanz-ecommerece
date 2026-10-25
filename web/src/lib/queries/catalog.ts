import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { cardPrice } from "@/lib/types";
import type { Banner, Brand, Category, HomepageSection, MenuLink, Announcement, Product, ProductCard, Variant, AttributeDef, ProductDocument, ProductImage } from "@/lib/types";

/** All public reads degrade to empty data if Supabase is not configured, so the site still renders during setup. */
function sb() { return createPublicClient(); }
async function safe<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error) { console.error("[catalog]", error); return fallback; }
    return (data ?? fallback) as T;
  } catch (e) { console.error("[catalog]", e); return fallback; }
}

export interface CategoryNode extends Category { children: CategoryNode[]; product_count?: number }

export async function getCategories(): Promise<Category[]> {
  const c = sb(); if (!c) return [];
  return safe(() => c.from("categories").select("*").eq("is_active", true).order("sort_order").order("name_en"), [] as Category[]);
}

export function buildTree(cats: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>(cats.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  map.forEach((n) => { (n.parent_id && map.get(n.parent_id) ? map.get(n.parent_id)!.children : roots).push(n); });
  return roots;
}

export async function getCategoryBySlug(slug: string) {
  const c = sb(); if (!c) return null;
  const { data } = await c.from("categories").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  return (data as Category | null) ?? null;
}

const CARD_SELECT = "*, product_images(storage_path,is_primary,sort_order), brands(name,name_ar), product_variants(price,is_active)";

export async function getProductCardsByIds(ids: string[]): Promise<ProductCard[]> {
  const c = sb(); if (!c || !ids.length) return [];
  const rows = await safe(() => c.from("products").select(CARD_SELECT).in("id", ids), [] as ProductCard[]);
  const order = new Map(ids.map((id, i) => [id, i]));
  return groupFamilies(rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
}

/**
 * One card per product family: confirmed offerings of a published family collapse into the first of them, which then carries the
 * family's name, photo, brand list and lowest price. Products outside a published family stay as they are.
 */
async function groupFamilies(cards: ProductCard[]): Promise<ProductCard[]> {
  const c = sb(); if (!c) return cards;
  const famIds = [...new Set(cards.filter((p) => p.family_id && p.family_link === "confirmed").map((p) => p.family_id!))];
  if (!famIds.length) return cards;
  const [fams, members] = await Promise.all([
    safe(() => c.from("product_families").select("id, slug, name_en, name_ar, image_path").in("id", famIds), [] as { id: string; slug: string; name_en: string; name_ar: string | null; image_path: string | null }[]),   // RLS: published only
    safe(() => c.from("products").select("id, family_id, family_sort, base_price, is_quote_only, brands(name,name_ar), product_variants(price,is_active), product_images(storage_path,is_primary,sort_order)").in("family_id", famIds).eq("family_link", "confirmed").eq("status", "published").order("family_sort").order("name_en"),
      [] as { id: string; family_id: string; family_sort: number; base_price: number | null; is_quote_only: boolean; brands: { name: string; name_ar: string | null }[]; product_variants: { price: number | null; is_active: boolean }[]; product_images: { storage_path: string; is_primary: boolean; sort_order: number }[] }[]),
  ]);
  const famMap = new Map(fams.map((f) => [f.id, f]));
  const seen = new Set<string>(); const out: ProductCard[] = [];
  for (const p of cards) {
    const f = p.family_id && p.family_link === "confirmed" ? famMap.get(p.family_id) : undefined;
    if (!f) { out.push(p); continue; }
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const ms = members.filter((m) => m.family_id === f.id);
    const prices = ms.map((m) => cardPrice(m as unknown as ProductCard)).filter((x): x is number => x != null);
    // family photo first; otherwise the first manufacturer (in admin order) that has a picture
    const firstImg = ms.map((m) => [...(m.product_images ?? [])].sort((x, y) => Number(y.is_primary) - Number(x.is_primary) || x.sort_order - y.sort_order)[0]?.storage_path).find(Boolean) ?? null;
    out.push({ ...p, family: { slug: f.slug, name_en: f.name_en, name_ar: f.name_ar, image_path: f.image_path ?? firstImg, price: prices.length ? Math.min(...prices) : null,
      brands: ms.map((m) => (Array.isArray(m.brands) ? m.brands[0] : m.brands)).filter((b): b is { name: string; name_ar: string | null } => !!b) } });
  }
  return out;
}

export interface SearchParams {
  q?: string; category?: string; filters?: Record<string, string[]>; availability?: string; flag?: string; sort?: string; page?: number; pageSize?: number;
}
export async function searchProducts(p: SearchParams): Promise<{ products: ProductCard[]; total: number }> {
  const c = sb(); if (!c) return { products: [], total: 0 };
  const pageSize = p.pageSize ?? 24;
  const rows = await safe<{ id: string; total: number }[]>(() => c.rpc("search_products", {
    p_q: p.q || null, p_category: p.category || null, p_filters: p.filters ?? {}, p_availability: p.availability || null, p_flag: p.flag || null,
    p_sort: p.sort || "newest", p_limit: pageSize, p_offset: ((p.page ?? 1) - 1) * pageSize,
  }), []);
  const total = rows[0] ? Number(rows[0].total) : 0;
  return { products: await getProductCardsByIds(rows.map((r) => r.id)), total };
}

export interface Facet { key: string; name_en: string; name_ar: string | null; values: { value_en: string; value_ar: string | null; n: number }[] }
export async function getFacets(q?: string, category?: string): Promise<Facet[]> {
  const c = sb(); if (!c) return [];
  const rows = await safe(() => c.rpc("product_facets", { p_q: q || null, p_category: category || null }),
    [] as { attr_key: string; attr_name_en: string; attr_name_ar: string | null; value_en: string; value_ar: string | null; n: number }[]);
  const map = new Map<string, Facet>();
  for (const r of rows) {
    if (!map.has(r.attr_key)) map.set(r.attr_key, { key: r.attr_key, name_en: r.attr_name_en, name_ar: r.attr_name_ar, values: [] });
    map.get(r.attr_key)!.values.push({ value_en: r.value_en, value_ar: r.value_ar, n: Number(r.n) });
  }
  return [...map.values()];
}

export async function getFlagged(flag: "featured" | "new" | "offer", limit = 8): Promise<ProductCard[]> {
  const { products } = await searchProducts({ flag, pageSize: limit });
  return products;
}

export async function getBestSellers(limit = 8): Promise<ProductCard[]> {
  const c = sb(); if (!c) return [];
  const rows = await safe<{ product_id: string }[]>(() => c.rpc("public_best_sellers", { p_limit: limit }), []);
  return getProductCardsByIds(rows.map((r) => r.product_id));
}

export interface ProductDetail {
  product: Product; images: ProductImage[]; variants: (Variant & { available: number })[]; documents: ProductDocument[];
  attributes: { def: AttributeDef; values: { value_en: string; value_ar: string | null }[] }[];
  brand: Brand | null; category: Category | null; related: ProductCard[]; alternatives: ProductCard[];
  options: ProductOptionRow[]; dimensionTables: DimensionTableRow[]; family: { slug: string; name_en: string; name_ar: string | null } | null;
}
export interface ProductOptionRow { key: string; name_en: string; name_ar: string | null; values: { value: string; label_en: string; label_ar: string | null }[] }
export interface DimensionTableRow { id: string; title_en: string; title_ar: string | null; columns: { key: string; symbol?: string | null; label_en: string; label_ar?: string | null; unit?: string | null }[]; applies: Record<string, string>; notes: string[]; drawing_path: string | null; source_page: number | null; rows: { match: Record<string, string>; values: Record<string, string> }[] }

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const c = sb(); if (!c) return null;
  const { data: product } = await c.from("products").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!product) return null;
  return productDetail(c, product as Product, false);
}

export interface FamilyDetail {
  family: { id: string; slug: string; name_en: string; name_ar: string | null; product_type: string | null; short_desc_en: string | null; short_desc_ar: string | null; description_en: string | null; description_ar: string | null;
    image_path: string | null; seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null; seo_noindex: boolean; updated_at: string };
  category: Category | null; offerings: ProductDetail[];
}
/** A published product family with its confirmed, published manufacturer offerings (each with its own variants, tables, drawings and documents). */
export async function getFamilyBySlug(slug: string): Promise<FamilyDetail | null> {
  const c = sb(); if (!c) return null;
  const { data: fam } = await c.from("product_families").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!fam) return null;
  const { data: prods } = await c.from("products").select("*").eq("family_id", fam.id).eq("status", "published").eq("family_link", "confirmed").order("family_sort").order("name_en");
  if (!prods?.length) return null;
  const offerings = await Promise.all((prods as Product[]).map((p) => productDetail(c, p, true)));
  const category = fam.category_id ? await c.from("categories").select("*").eq("id", fam.category_id).maybeSingle().then((r) => r.data as Category | null) : offerings[0]?.category ?? null;
  return { family: fam as FamilyDetail["family"], category, offerings };
}

async function productDetail(c: NonNullable<ReturnType<typeof sb>>, product: Product, lite: boolean): Promise<ProductDetail> {
  const pid = product.id;
  const [images, variants, docs, attrs, defs, brand, category, rels, avail, opts, dims, family] = await Promise.all([
    safe(() => c.from("product_images").select("*").eq("product_id", pid).order("is_primary", { ascending: false }).order("sort_order"), [] as ProductImage[]),
    safe(() => c.from("product_variants").select("*").eq("product_id", pid).eq("is_active", true).order("sort_order").order("sku"), [] as Variant[]),
    safe(() => c.from("product_documents").select("*").eq("product_id", pid), [] as ProductDocument[]),
    safe(() => c.from("product_attribute_values").select("*").eq("product_id", pid).order("sort_order"), [] as { attribute_id: string; value_en: string; value_ar: string | null }[]),
    safe(() => c.from("attribute_defs").select("*").order("sort_order"), [] as AttributeDef[]),
    (product as Product).brand_id ? c.from("brands").select("*").eq("id", (product as Product).brand_id!).maybeSingle().then((r) => r.data as Brand | null) : Promise.resolve(null),
    (product as Product).category_id ? c.from("categories").select("*").eq("id", (product as Product).category_id!).maybeSingle().then((r) => r.data as Category | null) : Promise.resolve(null),
    safe(() => c.from("product_relations").select("related_id, relation").eq("product_id", pid).order("sort_order"), [] as { related_id: string; relation: string }[]),
    safe(() => c.from("variant_availability").select("variant_id, available").eq("product_id", pid), [] as { variant_id: string; available: number }[]),
    safe(() => c.from("product_options").select("key, name_en, name_ar, sort_order, product_option_values(value, label_en, label_ar, sort_order)").eq("product_id", pid).order("sort_order"), [] as { key: string; name_en: string; name_ar: string | null; sort_order: number; product_option_values: { value: string; label_en: string; label_ar: string | null; sort_order: number }[] }[]),
    safe(() => c.from("dimension_tables").select("id, title_en, title_ar, columns, applies, notes, drawing_path, source_page, sort_order, dimension_rows(match, values, sort_order)").eq("product_id", pid).order("sort_order"), [] as (Omit<DimensionTableRow, "rows"> & { sort_order: number; dimension_rows: { match: Record<string, string>; values: Record<string, string>; sort_order: number }[] })[]),
    (product as Product & { family_id?: string | null }).family_id ? c.from("product_families").select("slug, name_en, name_ar")   /* RLS: published families only */.eq("id", (product as Product & { family_id: string }).family_id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);
  const availMap = new Map(avail.map((a) => [a.variant_id, Number(a.available)]));
  const attributes = defs
    .filter((d) => d.show_in_specs)
    .map((def) => ({ def, values: attrs.filter((a) => a.attribute_id === def.id).map((a) => ({ value_en: a.value_en, value_ar: a.value_ar })) }))
    .filter((a) => a.values.length);
  let related = lite ? [] : await getProductCardsByIds(rels.filter((r) => r.relation === "related").map((r) => r.related_id));
  const alternatives = lite ? [] : await getProductCardsByIds(rels.filter((r) => r.relation === "alternative").map((r) => r.related_id));
  if (!lite && !related.length && (product as Product).category_id) {   // fall back to same-category products
    const res = await searchProducts({ category: (product as Product).category_id!, pageSize: 5 });
    related = res.products.filter((p) => p.id !== pid).slice(0, 4);
  }
  return {
    product: product as Product, images, variants: variants.map((v) => ({ ...v, available: availMap.get(v.id) ?? 0 })),
    documents: docs.filter((d) => d.is_public), attributes, brand, category, related, alternatives,
    options: opts.map((o) => ({ key: o.key, name_en: o.name_en, name_ar: o.name_ar, values: [...(o.product_option_values ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(({ value, label_en, label_ar }) => ({ value, label_en, label_ar })) })),
    dimensionTables: dims.map(({ dimension_rows, ...t }) => ({ ...t, notes: (t.notes ?? []) as string[], rows: [...(dimension_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(({ match, values }) => ({ match, values })) })),
    family: family ?? null,
  };
}

/** Where an old product/category address now lives (kept automatically whenever a slug changes). */
export async function getSlugRedirect(entity: "product" | "category", slug: string): Promise<string | null> {
  const c = sb(); if (!c) return null;
  const { data } = await c.from("slug_redirects").select("new_slug").eq("entity", entity).eq("old_slug", slug).maybeSingle();
  return data?.new_slug ?? null;
}

/** Published-product counts per category, including sub-categories. Empty categories are kept out of the sitemap and set to noindex until they have products. */
export async function getCategoryProductCounts(): Promise<Map<string, number>> {
  const c = sb(); const out = new Map<string, number>(); if (!c) return out;
  // listing entries (a product family counts once) per category including sub-categories
  const rows = await safe(() => c.rpc("category_listing_counts"), [] as { category_id: string; n: number }[]);
  for (const r of rows) out.set(r.category_id, Number(r.n));
  return out;
}

export async function getAllSlugsForSitemap() {
  const c = sb(); if (!c) return { products: [], categories: [], families: [] };
  const [products, categories, counts, fams] = await Promise.all([
    safe(() => c.from("products").select("slug, updated_at, name_ar, seo_noindex, family_id, family_link").eq("status", "published"), [] as { slug: string; updated_at: string; name_ar: string | null; seo_noindex: boolean; family_id: string | null; family_link: string }[]),
    safe(() => c.from("categories").select("id, slug, updated_at, name_ar, seo_noindex").eq("is_active", true), [] as { id: string; slug: string; updated_at: string; name_ar: string | null; seo_noindex: boolean }[]),
    getCategoryProductCounts(),
    safe(() => c.from("product_families").select("id, slug, updated_at, name_ar, seo_noindex").eq("status", "published"), [] as { id: string; slug: string; updated_at: string; name_ar: string | null; seo_noindex: boolean }[]),
  ]);
  // a family page exists only when it has at least one confirmed, published offering; those offerings redirect to it and are not listed themselves
  const live = new Set(products.filter((p) => p.family_link === "confirmed" && p.family_id).map((p) => p.family_id!));
  const families = fams.filter((f) => live.has(f.id));
  const famIds = new Set(families.map((f) => f.id));
  return {
    products: products.filter((p) => !p.seo_noindex && !(p.family_link === "confirmed" && p.family_id && famIds.has(p.family_id))),
    categories: categories.filter((x) => !x.seo_noindex && (counts.get(x.id) ?? 0) > 0),
    families: families.filter((f) => !f.seo_noindex),
  };
}

// ── CMS ───────────────────────────────────────────────────────
export async function getHomepageSections(): Promise<HomepageSection[]> {
  const c = sb(); if (!c) return [];
  return safe(() => c.from("homepage_sections").select("*").eq("is_enabled", true).order("sort_order"), [] as HomepageSection[]);
}
export async function getBanners(placement: string, categoryId?: string): Promise<Banner[]> {
  const c = sb(); if (!c) return [];
  // RLS already restricts to active + scheduled-now banners
  let q = c.from("banners").select("*").eq("placement", placement).order("sort_order");
  if (categoryId) q = q.eq("category_id", categoryId);
  return safe(() => q, [] as Banner[]);
}
export async function getMenu(menu: string): Promise<MenuLink[]> {
  const c = sb(); if (!c) return [];
  return safe(() => c.from("menu_links").select("*").eq("menu", menu).eq("is_active", true).order("sort_order"), [] as MenuLink[]);
}
export async function getAnnouncements(): Promise<Announcement[]> {
  const c = sb(); if (!c) return [];
  return safe(() => c.from("announcements").select("*").order("sort_order"), [] as Announcement[]);
}
export async function getHomepageBrands(): Promise<Brand[]> {
  const c = sb(); if (!c) return [];
  return safe(() => c.from("brands").select("*").eq("is_active", true).eq("show_on_homepage", true).order("sort_order"), [] as Brand[]);
}
export async function countPublishedProducts(): Promise<number> {
  const c = sb(); if (!c) return 0;
  const n = await safe(() => c.rpc("listing_count"), 0 as number);   // product families count once
  return Number(n) || 0;
}
