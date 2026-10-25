import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { FamilyEditor, type FamilyForm, type OfferingRow } from "@/components/admin/family-manager";
import { scanSuggestions } from "@/lib/families/scan";

export const metadata = { title: "Product family" };
export const dynamic = "force-dynamic";

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const user = await requireStaff(); const sb = await createClient();
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  if (!isNew) await scanSuggestions(sb);
  const [{ data: fam }, { data: cats }, { data: offers }, { data: all }, { data: sugg }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : sb.from("product_families").select("*").eq("id", id).maybeSingle(),
    sb.from("categories").select("id, name_en, parent_id").order("sort_order"),
    isNew ? Promise.resolve({ data: [] }) : sb.from("products").select("id, slug, name_en, status, family_link, family_sort, brands(name), product_variants(count), dimension_tables(count), product_images(count), product_documents(count)").eq("family_id", id).order("family_sort").order("name_en"),
    sb.from("products").select("id, name_en, family_id, brands(name)").order("name_en").limit(2000),
    isNew ? Promise.resolve({ data: [] }) : sb.from("family_link_suggestions").select("product_id, confidence, reasons").eq("family_id", id),
  ]);
  if (!isNew && !fam) notFound();
  const sMap = new Map((sugg ?? []).map((s) => [s.product_id, s]));
  const cnt = (x: unknown) => (Array.isArray(x) ? (x[0] as { count: number } | undefined)?.count ?? 0 : 0);
  const rows: OfferingRow[] = (offers ?? []).map((o) => { const b = Array.isArray(o.brands) ? o.brands[0] : o.brands; const s = sMap.get(o.id);
    return { id: o.id, slug: o.slug, name: o.name_en, brand: (b as { name: string } | null)?.name ?? "-", status: o.status, link: o.family_link, variants: cnt(o.product_variants), tables: cnt(o.dimension_tables), images: cnt(o.product_images), docs: cnt(o.product_documents),
      confidence: s?.confidence ?? null, reasons: (s?.reasons as string[] | undefined) ?? [] }; });
  const form: FamilyForm = fam ? { ...fam, name_ar: fam.name_ar ?? "", product_type: fam.product_type ?? "", category_id: fam.category_id ?? "", short_desc_en: fam.short_desc_en ?? "", short_desc_ar: fam.short_desc_ar ?? "", description_en: fam.description_en ?? "", description_ar: fam.description_ar ?? "",
    image_path: fam.image_path ?? "", seo_title_en: fam.seo_title_en ?? "", seo_title_ar: fam.seo_title_ar ?? "", seo_desc_en: fam.seo_desc_en ?? "", seo_desc_ar: fam.seo_desc_ar ?? "" }
    : { id: "", slug: "", name_en: "", name_ar: "", product_type: "", category_id: "", short_desc_en: "", short_desc_ar: "", description_en: "", description_ar: "", image_path: "", seo_title_en: "", seo_title_ar: "", seo_desc_en: "", seo_desc_ar: "", seo_noindex: false, status: "draft" };
  const candidates = (all ?? []).filter((p) => p.family_id !== id).map((p) => { const b = Array.isArray(p.brands) ? p.brands[0] : p.brands; return { id: p.id, label: `${p.name_en}${(b as { name: string } | null)?.name ? ` (${(b as { name: string }).name})` : ""}${p.family_id ? " - in another family" : ""}` }; });
  return (<><PageHeader title={isNew ? "New product family" : fam!.name_en} description="The family page shows one product type; each confirmed manufacturer offering keeps its own data." />
    <FamilyEditor form={form} offerings={rows} categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name_en }))} candidates={candidates} isAdmin={user.role === "admin"} /></>);
}
