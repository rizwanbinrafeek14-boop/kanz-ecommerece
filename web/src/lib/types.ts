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
export interface ProductImage { id: string; product_id: string; storage_path: string; alt_en: string | null; alt_ar: string | null; sort_order: number; is_primary: boolean; needs_hires: boolean; option_match?: Record<string, string> | null }
export interface ProductDocument { id: string; product_id: string; kind: "datasheet" | "mtc" | "certificate" | "other"; title: string; storage_path: string; is_public: boolean }
export interface AttributeDef { id: string; key: string; name_en: string; name_ar: string | null; is_filterable: boolean; show_in_specs: boolean; sort_order: number }
export interface AttributeValue { product_id: string; attribute_id: string; value_en: string; value_ar: string | null; sort_order: number }
export interface Variant {
  id: string; product_id: string; sku: string; barcode: string | null; label_en: string | null; label_ar: string | null;
  size: string | null; grade: string | null; schedule: string | null; pressure_class: string | null; material: string | null;
  price: number | null; is_active: boolean; sort_order: number;
  options?: Record<string, string>; manufacturer_code?: string | null; weight_kg?: number | null; material_code?: string | null;
}
export interface Product {
  id: string; slug: string; sku: string | null; barcode: string | null; name_en: string; name_ar: string | null;
  short_desc_en: string | null; short_desc_ar: string | null; description_en: string | null; description_ar: string | null;
  category_id: string | null; brand_id: string | null; family_id?: string | null; family_link?: "suggested" | "confirmed" | "rejected"; family_sort?: number; status: ProductStatus; is_quote_only: boolean;
  is_featured: boolean; is_new_arrival: boolean; is_special_offer: boolean; offer_label_en: string | null; offer_label_ar: string | null;
  base_price: number | null; compare_at_price: number | null; unit: string; min_order_qty: number; view_count: number;
  source_page: number | null; seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null;
  og_title_en: string | null; og_title_ar: string | null; og_desc_en: string | null; og_desc_ar: string | null; og_image_path: string | null; seo_noindex: boolean;
  published_at: string | null; created_at: string; updated_at: string;
  manufacturer_ref?: string | null; country_of_origin?: string | null; applications_en?: string | null; applications_ar?: string | null;
  specs?: { standards?: { code: string; scope: "product" | "general"; note?: string | null }[]; materials?: { type: string; grades: string[] }[]; notes?: string[]; choices?: ConfigChoice[]; properties?: { label_en: string; label_ar?: string | null; value_en: string; value_ar?: string | null }[];
    /** Product-page overview: what it seals / connects to, and what the customer must confirm before ordering. */
    overview?: { seals_en?: string | null; seals_ar?: string | null; confirm_en?: string[]; confirm_ar?: string[] };
    /** Interactive explanation on the product page (only types with a built visual). */
    visual?: { type?: "spiral-wound-gasket" | null; enable_3d?: boolean } } | null;
  source_ref?: { title?: string; pages?: number[]; import?: string; review?: string[]; possible_matches?: string | null; supplier_note?: string } | null;
}
/**
 * A configuration choice that does not change the catalogue variant (winding metal, filler, sheet material, thickness …).
 * It is asked on the product page and written into the enquiry. `requires` limits it to some variant options (e.g. inner ring
 * material only for styles with an inner ring); a value's `requires` does the same for that value; `material` links a value to a material code.
 */
export interface ConfigChoice {
  key: string; name_en: string; name_ar?: string | null; type: "select" | "number" | "text"; required?: boolean;
  values?: { value: string; label_en: string; label_ar?: string | null; material?: string; requires?: Record<string, string[]>; hint_en?: string }[];
  requires?: Record<string, string[]>; requires_choice?: Record<string, string[]>; hint_en?: string; hint_ar?: string; min?: number; max?: number; step?: number; unit?: string; maxlength?: number;
}
export interface ProductCard extends Product {
  product_images: Pick<ProductImage, "storage_path" | "is_primary" | "sort_order">[];
  brands: Pick<Brand, "name" | "name_ar"> | null;
  product_variants?: { price: number | null; is_active: boolean }[];
  /** Set when this card stands for a whole product family (one card per family, several manufacturers inside). */
  family?: { slug: string; name_en: string; name_ar: string | null; image_path: string | null; brands: { name: string; name_ar: string | null }[]; price: number | null; memberIds?: string[] };
  /** Shown materials (codes, in material order) of this product, or of all manufacturers of a family card. */
  materials?: { code: string; name_en: string; name_ar: string | null }[];
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
