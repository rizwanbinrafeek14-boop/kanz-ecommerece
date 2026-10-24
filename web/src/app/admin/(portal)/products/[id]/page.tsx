import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { publicUrl } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor, type ProductFull } from "@/components/admin/product-editor";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff();
  const sb = await createClient();
  const { data: p } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [cats, brands, cost, vars, vcosts, avail, defs, vals, imgs, docs, rels, allCerts, pcerts] = await Promise.all([
    sb.from("categories").select("id, name_en, parent_id, sort_order").order("sort_order"), sb.from("brands").select("id, name").order("name"),
    sb.from("product_costs").select("purchase_cost").eq("product_id", id).maybeSingle(), sb.from("product_variants").select("*").eq("product_id", id).order("sort_order").order("sku"),
    sb.from("variant_costs").select("variant_id, purchase_cost"), sb.from("variant_availability").select("variant_id, available").eq("product_id", id),
    sb.from("attribute_defs").select("id, key, name_en, is_filterable").order("sort_order"), sb.from("product_attribute_values").select("*").eq("product_id", id),
    sb.from("product_images").select("*").eq("product_id", id).order("is_primary", { ascending: false }).order("sort_order"), sb.from("product_documents").select("*").eq("product_id", id).order("created_at"),
    sb.from("product_relations").select("related_id, relation, sort_order, products!product_relations_related_id_fkey(name_en)").eq("product_id", id).order("sort_order"),
    sb.from("certifications").select("id, name_en, is_active, valid_until, issued_at").order("sort_order").order("name_en"), sb.from("product_certifications").select("*").eq("product_id", id),
  ]);
  const vc = new Map((vcosts.data ?? []).map((c) => [c.variant_id, c.purchase_cost])); const av = new Map((avail.data ?? []).map((a) => [a.variant_id, Number(a.available)]));
  const mtc = (docs.data ?? []).filter((d) => !d.is_public).map((d) => d.storage_path);
  const { data: signed } = mtc.length ? await sb.storage.from("product-mtc").createSignedUrls(mtc, 3600) : { data: [] };
  const sUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const relRows = (kind: string) => (rels.data ?? []).filter((r) => r.relation === kind).map((r: any) => ({ id: r.related_id as string, name: (Array.isArray(r.products) ? r.products[0] : r.products)?.name_en ?? r.related_id }));
  const product: ProductFull = { ...(p as ProductFull), purchase_cost: cost.data ? Number(cost.data.purchase_cost) : null, base_price: p.base_price == null ? null : Number(p.base_price), compare_at_price: p.compare_at_price == null ? null : Number(p.compare_at_price), min_order_qty: Number(p.min_order_qty) };
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Products</Link>
      <PageHeader title={p.name_en} description={p.source_page ? `Imported from catalogue page ${p.source_page}` : undefined} />
      <ProductEditor product={product} isAdmin={user.role === "admin"}
        categories={(cats.data ?? []).map((c) => ({ id: c.id, name: c.name_en, parent_id: c.parent_id }))} brands={(brands.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
        variants={(vars.data ?? []).map((v) => ({ id: v.id, sku: v.sku, barcode: v.barcode ?? "", label_en: v.label_en ?? "", label_ar: v.label_ar ?? "", size: v.size ?? "", grade: v.grade ?? "", schedule: v.schedule ?? "", pressure_class: v.pressure_class ?? "", material: v.material ?? "", price: v.price == null ? "" : String(v.price), purchase_cost: vc.has(v.id) ? String(vc.get(v.id)) : "", is_active: v.is_active, available: av.get(v.id) ?? 0 }))}
        attrDefs={defs.data ?? []} attrValues={vals.data ?? []}
        images={(imgs.data ?? []).map((i) => ({ id: i.id, storage_path: i.storage_path, is_primary: i.is_primary, needs_hires: i.needs_hires, sort_order: i.sort_order, alt_en: i.alt_en }))}
        docs={(docs.data ?? []).map((d) => ({ id: d.id, kind: d.kind, title: d.title, storage_path: d.storage_path, is_public: d.is_public, url: d.is_public ? publicUrl("product-docs", d.storage_path) : sUrl.get(d.storage_path) ?? null }))}
        certOptions={(allCerts.data ?? []).map((c) => ({ id: c.id, name: c.name_en, note: !c.is_active ? "Unpublished — hidden" : c.valid_until && c.valid_until < new Date().toISOString().slice(0, 10) ? "Expired — hidden" : c.issued_at && c.issued_at > new Date().toISOString().slice(0, 10) ? "Not valid yet — hidden" : null }))}
        assignments={(pcerts.data ?? []).map((a) => ({ certification_id: a.certification_id, status: a.status, reference_number: a.reference_number, document_path: a.document_path, verification_url: a.verification_url, scope_note: a.scope_note, variant_ids: a.variant_ids ?? [] }))}
        variantOptions={(vars.data ?? []).map((v) => ({ id: v.id, label: [v.label_en || v.size, v.sku].filter(Boolean).join(" · ") }))} related={relRows("related")} alternatives={relRows("alternative")} />
    </>
  );
}
