import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings, vatRateOf } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { RfqWorkbench } from "@/components/admin/rfq-workbench";

export const metadata = { title: "Quotation" };

export default async function RfqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data: rfq } = await sb.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq) notFound();
  const [{ data: items }, { data: events }, { data: notes }, st, { data: files }] = await Promise.all([
    sb.from("rfq_items").select("*, products(slug, name_en), product_variants(sku)").eq("rfq_id", id).order("line_no"),
    sb.from("rfq_events").select("id, event, detail, created_at, profiles(full_name)").eq("rfq_id", id).order("created_at", { ascending: false }),
    sb.from("internal_notes").select("id, note, created_at, profiles(full_name)").eq("entity", "rfq").eq("entity_id", id).order("created_at", { ascending: false }), getSettings(),
    sb.from("rfq_attachments").select("id, file_name, storage_path, size_bytes, content_type, created_at").eq("rfq_id", id).order("created_at"),
  ]);
  // files the customer attached: private bucket, so staff get short-lived download links
  const { data: signed } = files?.length ? await sb.storage.from("rfq-attachments").createSignedUrls(files.map((f) => f.storage_path), 600, { download: true }) : { data: [] };
  const fileUrl = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  return (<>
    <Link href="/admin/rfqs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Quotations</Link>
    <PageHeader title={rfq.rfq_number} description={<span className="inline-flex items-center gap-2"><StatusBadge status={rfq.status} /> Received {new Date(rfq.created_at).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</span>} />
    {(files ?? []).length > 0 && (
      <Panel title={`Customer files (${files!.length})`} className="mb-6">
        <ul className="divide-y text-sm" data-admin-rfq-files>{files!.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 py-2"><Paperclip className="size-4 text-primary" aria-hidden="true" />
            {fileUrl.get(f.storage_path) ? <a href={fileUrl.get(f.storage_path)!} className="font-medium text-primary hover:underline">{f.file_name}</a> : <span>{f.file_name}</span>}
            <span className="text-xs text-muted-foreground">{f.size_bytes ? `${Math.max(1, Math.round(f.size_bytes / 1024))} KB` : ""} · {new Date(f.created_at).toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}</span></li>))}</ul>
        <p className="mt-2 text-xs text-muted-foreground">Download links are valid for 10 minutes; files are stored privately. Open unexpected files with care.</p>
      </Panel>)}
    <RfqWorkbench rfq={rfq} items={(items ?? []).map((i: any) => ({ id: i.id, line_no: i.line_no, description: i.description, specification: i.specification, quantity: Number(i.quantity), unit: i.unit, quoted_unit_price: i.quoted_unit_price == null ? null : Number(i.quoted_unit_price), quoted_lead_time: i.quoted_lead_time, sku: i.product_variants?.sku ?? null, productSlug: i.products?.slug ?? null }))}
      events={(events ?? []).map((e: any) => ({ id: e.id, event: e.event, detail: e.detail, at: e.created_at, by: e.profiles?.full_name ?? null }))} notes={(notes ?? []).map((n: any) => ({ id: n.id, note: n.note, at: n.created_at, by: n.profiles?.full_name ?? null }))} vatRate={vatRateOf(st)} />
  </>);
}
