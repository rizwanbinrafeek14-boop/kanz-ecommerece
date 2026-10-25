// Hand-written row types (kept in sync with supabase/migrations). Replace with `supabase gen types` output if preferred.
export type ProductStatus = "draft" | "published" | "archived";

export interface Category {
  id: string; parent_id: string | null; slug: string; name_en: string; name_ar: string | null;
  description_en: string | null; description_ar: string | null; image_path: string | null;
  sort_order: number; is_active: boolean; is_featured: boolean;
  seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null;
  seo_noindex: boolean; buying_guide_en: string | null; buying_guide_ar: string | null;
}
export interface Brand { id: string; slug: string; name: string; name_ar: string | null; logo_path: string | null; website: string | null; sort_order: number; is_active: boolean; show_on_homepage: boolean }
export interface ProductImage { id: string; product_id: string; storage_path: string; alt_en: string | null; alt_ar: string | null; sort_order: number; is_primary: boolean; needs_hires: boolean }
export interface ProductDocument { id: string; product_id: string; kind: "datasheet" | "mtc" | "certificate" | "other"; title: string; storage_path: string; is_public: boolean }
export interface AttributeDef { id: string; key: string; name_en: string; name_ar: string | null; is_filterable: boolean; show_in_specs: boolean; sort_order: number }
export interface AttributeValue { product_id: string; attribute_id: string; value_en: string; value_ar: string | null; sort_order: number }
export interface Variant {
  id: string; product_id: string; sku: string; barcode: string | null; label_en: string | null; label_ar: string | null;
  size: string | null; grade: string | null; schedule: string | null; pressure_class: string | null; material: string | null;
  price: number | null; is_active: boolean; sort_order: number;
  options?: Record<string, string>; manufacturer_code?: string | null; weight_kg?: number | null;
}
export interface Product {
  id: string; slug: string; sku: string | null; barcode: string | null; name_en: string; name_ar: string | null;
  short_desc_en: string | null; short_desc_ar: string | null; description_en: string | null; description_ar: string | null;
  category_id: string | null; brand_id: string | null; status: ProductStatus; is_quote_only: boolean;
  is_featured: boolean; is_new_arrival: boolean; is_special_offer: boolean; offer_label_en: string | null; offer_label_ar: string | null;
  base_price: number | null; compare_at_price: number | null; unit: string; min_order_qty: number; view_count: number;
  source_page: number | null; seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null;
  og_title_en: string | null; og_title_ar: string | null; og_desc_en: string | null; og_desc_ar: string | null; og_image_path: string | null; seo_noindex: boolean;
  published_at: string | null; created_at: string; updated_at: string;
  manufacturer_ref?: string | null; country_of_origin?: string | null; applications_en?: string | null; applications_ar?: string | null;
  specs?: { standards?: { code: string; scope: "product" | "general" }[]; materials?: { type: string; grades: string[] }[]; notes?: string[] } | null;
  source_ref?: { title?: string; pages?: number[] } | null;
}
export interface ProductCard extends Product {
  product_images: Pick<ProductImage, "storage_path" | "is_primary" | "sort_order">[];
  brands: Pick<Brand, "name" | "name_ar"> | null;
  product_variants?: { price: number | null; is_active: boolean }[];
}

/** Lowest sellable price (ex-VAT) for a card, or null when the product is quote-only. */
export function cardPrice(p: ProductCard): number | null {
  if (p.is_quote_only) return null;
  const vp = (p.product_variants ?? []).filter((v) => v.is_active && v.price != null).map((v) => Number(v.price));
  if (p.base_price != null) return Number(p.base_price);
  return vp.length ? Math.min(...vp) : null;
}
export interface Banner {
  id: string; placement: string; title_en: string | null; title_ar: string | null; subtitle_en: string | null; subtitle_ar: string | null;
  cta_label_en: string | null; cta_label_ar: string | null; desktop_image_path: string | null; mobile_image_path: string | null;
  alt_en: string | null; alt_ar: string | null; link_url: string | null; category_id: string | null;
  starts_at: string | null; ends_at: string | null; is_active: boolean; sort_order: number; impressions: number; clicks: number;
}
export interface HomepageSection { id: string; type: string; title_en: string | null; title_ar: string | null; subtitle_en: string | null; subtitle_ar: string | null; config: Record<string, unknown>; sort_order: number; is_enabled: boolean }
export interface MenuLink { id: string; menu: string; label_en: string; label_ar: string | null; url: string; sort_order: number; is_active: boolean }
export interface Announcement { id: string; text_en: string; text_ar: string | null; link_url: string | null; is_active: boolean; sort_order: number }
export type SettingsMap = Record<string, unknown>;
