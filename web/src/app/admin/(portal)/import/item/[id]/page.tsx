import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { ItemEditor } from "@/components/admin/import-item-editor";

export const metadata = { title: "Review import item" };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: item } = await sb.from("import_items").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();
  const [{ data: cats }, { data: defs }] = await Promise.all([
    sb.from("categories").select("slug, name_en, parent_id, sort_order").order("sort_order"), sb.from("attribute_defs").select("key, name_en").order("sort_order"),
  ]);
  const paths = [item.image_path, ...((item.extra?.images as string[]) ?? []), (item.extra?.document as { path?: string } | null)?.path].filter(Boolean) as string[];
  const { data: signed } = paths.length ? await sb.storage.from("import-staging").createSignedUrls(paths, 3600) : { data: [] };
  const urls = Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return (
    <>
      <Link href={`/admin/import/${item.batch_id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back to batch</Link>
      <PageHeader title={item.name_en} description={item.source_page ? `Catalogue page ${item.source_page}` : "Not from the uploaded PDF"} />
      <ItemEditor item={item} urls={urls} categories={cats ?? []} attributes={defs ?? []} />
    </>
  );
}
