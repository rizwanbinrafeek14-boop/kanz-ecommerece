import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { SourceWorkbench, type PageRow, type ItemRow } from "@/components/admin/catalogue/source-workbench";
import { claudeConfigured } from "@/lib/catalogue/claude";
import type { ExtractedProduct } from "@/lib/catalogue/schema";

export const metadata = { title: "Catalogue import" };

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireStaff(); const sb = await createClient();
  const { data: src } = await sb.from("catalogue_sources").select("id, title, file_path, page_count, status, brands(name)").eq("id", id).maybeSingle();
  if (!src) notFound();
  const [{ data: pages }, { data: items }, { data: warns }, { data: runs }] = await Promise.all([
    sb.from("catalogue_pages").select("page_no, status, image_path, method, skip_reason, error, products_found").eq("source_id", id).order("page_no"),
    sb.from("extracted_products").select("id, status, confidence, pages, duplicate_of, duplicate_info, imported_product_id, data").eq("source_id", id).order("created_at"),
    sb.from("extraction_warnings").select("extracted_product_id, severity").eq("source_id", id).eq("resolved", false),
    sb.from("catalogue_import_runs").select("created_at, summary").eq("source_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const imgPaths = (pages ?? []).map((p) => p.image_path).filter(Boolean) as string[];
  const { data: signed } = imgPaths.length ? await sb.storage.from("import-staging").createSignedUrls(imgPaths, 3600) : { data: [] };
  const sUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const { data: pdf } = src.file_path ? await sb.storage.from("catalogue-sources").createSignedUrl(src.file_path, 3600) : { data: null };
  const wc = (eid: string, sev: string) => (warns ?? []).filter((w) => w.extracted_product_id === eid && w.severity === sev).length;
  const brand = (Array.isArray(src.brands) ? src.brands[0] : src.brands) as { name: string } | null;
  return (<>
    <Link href="/admin/catalogue" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Catalogues</Link>
    <PageHeader title={src.title} description={`${brand?.name ?? "—"} · ${src.page_count} pages. Nothing here is public until you import approved records, and imports are created as unpublished drafts.`} />
    <SourceWorkbench sourceId={id} pdfUrl={pdf?.signedUrl ?? null} isAdmin={user.role === "admin"} claude={claudeConfigured()}
      pages={(pages ?? []).map((p) => ({ ...p, url: p.image_path ? sUrl.get(p.image_path) ?? null : null })) as PageRow[]}
      items={(items ?? []).map((r) => { const d = r.data as ExtractedProduct; return { id: r.id, status: r.status, confidence: r.confidence == null ? null : Number(r.confidence), pages: r.pages, name: d.name_en, family: d.family?.key, variants: d.variants?.length ?? 0, tables: d.dimension_tables?.length ?? 0, images: d.images?.length ?? 0, duplicate: (r.duplicate_info as { kind?: string; message?: string } | null) ?? null, imported: r.imported_product_id, errors: wc(r.id, "error"), warnings: wc(r.id, "warning") }; }) as ItemRow[]}
      runs={(runs ?? []) as { created_at: string; summary: { imported: number; failed: { name: string; error: string }[] } }[]} />
  </>);
}
