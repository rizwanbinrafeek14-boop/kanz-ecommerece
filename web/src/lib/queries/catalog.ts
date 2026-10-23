import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
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
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const c = sb(); if (!c) return null;
  const { data: product } = await c.from("products").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!product) return null;
  const pid = (product as Product).id;
  const [images, variants, docs, attrs, defs, brand, category, rels, avail] = await Promise.all([
    safe(() => c.from("product_images").select("*").eq("product_id", pid).order("is_primary", { ascending: false }).order("sort_order"), [] as ProductImage[]),
    safe(() => c.from("product_variants").select("*").eq("product_id", pid).eq("is_active", true).order("sort_order").order("sku"), [] as Variant[]),
    safe(() => c.from("product_documents").select("*").eq("product_id", pid), [] as ProductDocument[]),
    safe(() => c.from("product_attribute_values").select("*").eq("product_id", pid).order("sort_order"), [] as { attribute_id: string; value_en: string; value_ar: string | null }[]),
    safe(() => c.from("attribute_defs").select("*").order("sort_order"), [] as AttributeDef[]),
    (product as Product).brand_id ? c.from("brands").select("*").eq("id", (product as Product).brand_id!).maybeSingle().then((r) => r.data as Brand | null) : Promise.resolve(null),
    (product as Product).category_id ? c.from("categories").select("*").eq("id", (product as Product).category_id!).maybeSingle().then((r) => r.data as Category | null) : Promise.resolve(null),
    safe(() => c.from("product_relations").select("related_id, relation").eq("product_id", pid).order("sort_order"), [] as { related_id: string; relation: string }[]),
    safe(() => c.from("variant_availability").select("variant_id, available").eq("product_id", pid), [] as { variant_id: string; available: number }[]),
  ]);
  const availMap = new Map(avail.map((a) => [a.variant_id, Number(a.available)]));
  const attributes = defs
    .filter((d) => d.show_in_specs)
    .map((def) => ({ def, values: attrs.filter((a) => a.attribute_id === def.id).map((a) => ({ value_en: a.value_en, value_ar: a.value_ar })) }))
    .filter((a) => a.values.length);
  let related = await getProductCardsByIds(rels.filter((r) => r.relation === "related").map((r) => r.related_id));
  const alternatives = await getProductCardsByIds(rels.filter((r) => r.relation === "alternative").map((r) => r.related_id));
  if (!related.length && (product as Product).category_id) {   // fall back to same-category products
    const res = await searchProducts({ category: (product as Product).category_id!, pageSize: 5 });
    related = res.products.filter((p) => p.id !== pid).slice(0, 4);
  }
  return {
    product: product as Product, images, variants: variants.map((v) => ({ ...v, available: availMap.get(v.id) ?? 0 })),
    documents: docs.filter((d) => d.is_public), attributes, brand, category, related, alternatives,
  };
}

export async function getAllSlugsForSitemap() {
  const c = sb(); if (!c) return { products: [], categories: [] };
  const [products, categories] = await Promise.all([
    safe(() => c.from("products").select("slug, updated_at").eq("status", "published"), [] as { slug: string; updated_at: string }[]),
    safe(() => c.from("categories").select("slug, updated_at").eq("is_active", true), [] as { slug: string; updated_at: string }[]),
  ]);
  return { products, categories };
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
  const { count } = await c.from("products").select("id", { count: "exact", head: true }).eq("status", "published");
  return count ?? 0;
}
