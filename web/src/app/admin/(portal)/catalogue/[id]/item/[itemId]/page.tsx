import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ItemEditor } from "@/components/admin/catalogue/item-editor";
import type { ExtractedProduct } from "@/lib/catalogue/schema";
import type { Change } from "@/lib/admin/catalogue-store";

export const metadata = { title: "Review extracted product" };

export default async function ItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params; if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(itemId)) notFound();
  await requireStaff(); const sb = await createClient();
  const { data: row } = await sb.from("extracted_products").select("id, status, data, duplicate_info, imported_product_id, changes").eq("id", itemId).eq("source_id", id).maybeSingle();
  if (!row) notFound();
  const d = row.data as ExtractedProduct;
  const [{ data: pages }, { data: cats }] = await Promise.all([
    sb.from("catalogue_pages").select("page_no, image_path").eq("source_id", id).order("page_no"),
    sb.from("categories").select("slug, name_en, parent_id").eq("is_active", true).order("sort_order"),
  ]);
  const paths = (pages ?? []).map((p) => p.image_path).filter(Boolean) as string[];
  const { data: signed } = paths.length ? await sb.storage.from("import-staging").createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return (<>
    <Link href={`/admin/catalogue/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back to catalogue</Link>
    <PageHeader title={d.name_en} description={`Family ${d.family.key} · ${d.source_url ? "website page" : `pages ${d.pages.join(", ")}`} · status ${row.status}`} />
    <ItemEditor id={row.id} sourceId={id} status={row.status} initial={d} changes={(row.changes as Change[] | null) ?? null} duplicate={(row.duplicate_info as { kind?: string; message?: string } | null) ?? null}
      pages={(pages ?? []).map((p) => ({ page: p.page_no, url: p.image_path ? url.get(p.image_path) ?? null : null }))}
      categories={(cats ?? []).map((c) => ({ slug: c.slug, name: c.name_en, child: !!c.parent_id }))} />
  </>);
}
