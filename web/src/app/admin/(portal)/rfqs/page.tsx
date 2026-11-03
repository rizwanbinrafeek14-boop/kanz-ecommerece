import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { RfqOwner } from "@/components/admin/rfq-owner";
import { RfqAge } from "@/components/admin/rfq-age";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSAR } from "@/lib/format";
import { OPEN, RFQ_STATUSES, rfqListQuery, staffList, type RfqFilter } from "@/lib/admin/rfq-list";

export const metadata = { title: "Quotations" };
const PAGE = 30;

export default async function RfqsPage({ searchParams }: { searchParams: Promise<RfqFilter & { page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1);
  const me = await requireStaff(); const sb = await createClient();
  await sb.rpc("expire_overdue_quotations");
  const [{ data, count }, staff] = await Promise.all([
    rfqListQuery(sb, sp, me.id, "id, rfq_number, contact_name, company_name, status, quoted_total, created_at, assigned_to, rfq_items(count)").range((page - 1) * PAGE, page * PAGE - 1),
    staffList(sb),
  ]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const filters = Object.fromEntries((["q", "status", "owner", "age", "sort"] as const).filter((k) => sp[k]).map((k) => [k, sp[k]!]));
  const now = Date.now();   // eslint-disable-line react-hooks/purity -- server component, rendered per request
  return (<>
    <PageHeader title="Quotation requests (RFQ)" description="Review requests, add prices and validity, send a PDF, and convert accepted quotations into orders."
      actions={<div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><a href={`/api/admin/rfqs/export?${new URLSearchParams({ ...filters, format: "xlsx" })}`} data-rfq-export="xlsx"><Download className="size-4" />Excel</a></Button>
        <Button asChild variant="outline" size="sm"><a href={`/api/admin/rfqs/export?${new URLSearchParams({ ...filters, format: "csv" })}`} data-rfq-export="csv"><Download className="size-4" />CSV</a></Button></div>} />
    <form className="mb-4 flex flex-wrap gap-2" data-rfq-filters>
      <Input name="q" defaultValue={sp.q} placeholder="Search number, name, company, email…" className="max-w-xs" aria-label="Search" />
      <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-44" aria-label="Status"><option value="">All statuses</option><option value="open">Open (not yet quoted)</option>{RFQ_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</NativeSelect>
      <NativeSelect name="owner" defaultValue={sp.owner ?? ""} className="w-44" aria-label="Owner"><option value="">Any owner</option><option value="me">Mine</option><option value="none">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
      <NativeSelect name="age" defaultValue={sp.age ?? ""} className="w-48" aria-label="Waiting"><option value="">Any age</option><option value="24">Open, waiting over 24 h</option><option value="48">Open, waiting over 48 h</option><option value="168">Open, waiting over 7 days</option></NativeSelect>
      <NativeSelect name="sort" defaultValue={sp.sort ?? ""} className="w-36" aria-label="Sort"><option value="">Newest first</option><option value="old">Oldest first</option></NativeSelect>
      <Button variant="secondary">Filter</Button>{Object.keys(filters).length > 0 && <Button asChild variant="ghost"><Link href="/admin/rfqs">Clear</Link></Button>}
    </form>
    <p className="mb-2 text-sm text-muted-foreground" data-rfq-count>{count ?? 0} request{count === 1 ? "" : "s"}</p>
    <div className="overflow-x-auto rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead className="text-end">Lines</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Age</TableHead><TableHead className="text-end">Quoted total</TableHead><TableHead>Received</TableHead></TableRow></TableHeader>
      <TableBody>{(data ?? []).map((r: any) => (
        <TableRow key={r.id} data-rfq-row={r.rfq_number}><TableCell><Link href={`/admin/rfqs/${r.id}`} className="font-mono font-medium hover:text-primary">{r.rfq_number}</Link></TableCell><TableCell>{r.company_name || r.contact_name}{r.company_name && <span className="text-muted-foreground"> · {r.contact_name}</span>}</TableCell>
          <TableCell className="text-end">{r.rfq_items?.[0]?.count ?? 0}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell>
          <TableCell data-rfq-owner-cell>{r.assigned_to ? <span>{names.get(r.assigned_to) ?? "Former staff member"}{r.assigned_to === me.id && <span className="text-muted-foreground"> (me)</span>}</span> : (OPEN as readonly string[]).includes(r.status) ? <RfqOwner rfqId={r.id} owner={null} staff={staff} me={me.id} compact /> : <span className="text-muted-foreground">—</span>}</TableCell>
          <TableCell><RfqAge createdAt={r.created_at} open={(OPEN as readonly string[]).includes(r.status)} now={now} /></TableCell>
          <TableCell className="text-end tabular-nums">{r.quoted_total != null ? formatSAR(r.quoted_total) : "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell></TableRow>))}
        {!data?.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{Object.keys(filters).length ? "No requests match these filters." : "No quotation requests yet."}</TableCell></TableRow>}</TableBody></Table></div>
    {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...filters, page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
  </>);
}
