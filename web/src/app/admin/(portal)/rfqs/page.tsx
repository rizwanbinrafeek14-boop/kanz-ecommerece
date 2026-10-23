import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSAR } from "@/lib/format";

export const metadata = { title: "Quotations" };
const PAGE = 30;

export default async function RfqsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1); const sb = await createClient();
  await sb.rpc("expire_overdue_quotations");
  let q = sb.from("rfqs").select("id, rfq_number, contact_name, company_name, status, quoted_total, created_at, rfq_items(count)", { count: "exact" });
  if (sp.status) q = q.eq("status", sp.status as "submitted");
  if (sp.q) { const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`rfq_number.ilike.%${t}%,contact_name.ilike.%${t}%,company_name.ilike.%${t}%,contact_email.ilike.%${t}%`); }
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (<>
    <PageHeader title="Quotation requests (RFQ)" description="Review requests, add prices and validity, send a PDF, and convert accepted quotations into orders." />
    <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q} placeholder="Search number, name, company, email…" className="max-w-xs" />
      <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-44"><option value="">All statuses</option>{["submitted", "under_review", "quoted", "accepted", "rejected", "expired", "converted", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</NativeSelect><Button variant="secondary">Filter</Button></form>
    <div className="overflow-hidden rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead className="text-end">Lines</TableHead><TableHead>Status</TableHead><TableHead className="text-end">Quoted total</TableHead><TableHead>Received</TableHead></TableRow></TableHeader>
      <TableBody>{(data ?? []).map((r: any) => (
        <TableRow key={r.id}><TableCell><Link href={`/admin/rfqs/${r.id}`} className="font-mono font-medium hover:text-primary">{r.rfq_number}</Link></TableCell><TableCell>{r.company_name || r.contact_name}{r.company_name && <span className="text-muted-foreground"> · {r.contact_name}</span>}</TableCell>
          <TableCell className="text-end">{r.rfq_items?.[0]?.count ?? 0}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell><TableCell className="text-end tabular-nums">{r.quoted_total != null ? formatSAR(r.quoted_total) : "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell></TableRow>))}
        {!data?.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No quotation requests yet.</TableCell></TableRow>}</TableBody></Table></div>
    {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
  </>);
}
