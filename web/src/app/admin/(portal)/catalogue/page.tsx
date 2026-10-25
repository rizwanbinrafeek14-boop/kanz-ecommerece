import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { UploadForm } from "@/components/admin/catalogue/upload-form";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Catalogue import" };

export default async function CataloguePage() {
  await requireStaff(); const sb = await createClient();
  const [{ data: sources }, { data: brands }, { data: pages }, { data: items }] = await Promise.all([
    sb.from("catalogue_sources").select("id, title, page_count, status, created_at, brands(name)").order("created_at", { ascending: false }),
    sb.from("brands").select("id, name").order("name"),
    sb.from("catalogue_pages").select("source_id, status"),
    sb.from("extracted_products").select("source_id, status"),
  ]);
  const count = (rows: { source_id: string; status: string }[] | null, id: string, st?: string) => (rows ?? []).filter((r) => r.source_id === id && (!st || r.status === st)).length;
  return (<>
    <PageHeader title="Catalogue import" description="Upload manufacturer catalogues, extract products, sizes and dimension tables, review every value against the source page, then import approved records as unpublished drafts." />
    <div className="space-y-6">
      <UploadForm brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name }))} />
      <Panel title="Catalogues">
        {!sources?.length ? <p className="py-6 text-center text-sm text-muted-foreground">No catalogues uploaded yet.</p> : (
          <ul className="divide-y">{sources.map((s) => { const brand = (Array.isArray(s.brands) ? s.brands[0] : s.brands) as { name: string } | null; const done = (pages ?? []).filter((p) => p.source_id === s.id && ["extracted", "skipped"].includes(p.status)).length; return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><Link href={`/admin/catalogue/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                <p className="text-xs text-muted-foreground">{brand?.name ?? "—"} · {s.page_count} pages · uploaded {formatDateTime(s.created_at)}</p></div>
              <span className="text-sm tabular-nums text-muted-foreground">{done}/{s.page_count} pages processed</span>
              <span className="text-sm tabular-nums text-muted-foreground">{count(items, s.id)} products · {count(items, s.id, "imported")} imported</span>
              <Badge variant={s.status === "done" ? "success" : "secondary"}>{s.status}</Badge>
            </li>); })}</ul>)}
      </Panel>
    </div>
  </>);
}
