import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { BatchReview, type ReviewItem } from "@/components/admin/import-batch-review";
import { SharedFilePanel } from "@/components/admin/shared-file-panel";

export const metadata = { title: "Import review" };

export default async function BatchPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ status?: string; flag?: string; q?: string }> }) {
  const { batchId } = await params; const sp = await searchParams;
  const sb = await createClient();
  const { data: batch } = await sb.from("import_batches").select("id, source_name, shared_file_path").eq("id", batchId).maybeSingle();
  if (!batch) notFound();
  const { data: items } = await sb.from("import_items").select("id, name_en, name_ar, suggested_category_slug, status, flags, image_path, source_page, published_product_id, extra").eq("batch_id", batchId).order("source_page", { nullsFirst: false }).order("name_en");
  const paths = (items ?? []).map((i) => i.image_path).filter(Boolean) as string[];
  const { data: signed } = paths.length ? await sb.storage.from("import-staging").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const { data: cats } = await sb.from("categories").select("slug, name_en");
  const catName = new Map((cats ?? []).map((c) => [c.slug, c.name_en]));
  const rows: ReviewItem[] = (items ?? []).map((i) => ({ ...i, flags: i.flags as string[], image: i.image_path ? urlOf.get(i.image_path) ?? null : null, category: catName.get(i.suggested_category_slug ?? "") ?? null }));
  return (
    <>
      <Link href="/admin/import" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />All batches</Link>
      <PageHeader title={batch.source_name} description="Review each item: fix names and specifications, replace the image if needed, then approve. Approved items become DRAFT quote-only products (no prices, SKUs or stock are invented)." />
      {(items ?? []).some((i) => (i.extra as { mtc?: unknown } | null)?.mtc) && <SharedFilePanel batchId={batch.id} current={batch.shared_file_path} />}
      <BatchReview items={rows} initialStatus={sp.status ?? "all"} initialFlag={sp.flag ?? ""} />
    </>
  );
}
