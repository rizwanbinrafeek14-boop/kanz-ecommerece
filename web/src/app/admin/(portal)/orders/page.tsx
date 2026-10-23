import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSAR } from "@/lib/format";

export const metadata = { title: "Orders" };
const PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; pay?: string; page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1); const sb = await createClient();
  let q = sb.from("orders").select("id, order_number, customer_name, company_name, status, payment_status, grand_total, delivery_method, created_at", { count: "exact" });
  if (sp.status) q = q.eq("status", sp.status as "pending"); if (sp.pay) q = q.eq("payment_status", sp.pay as "paid");
  if (sp.q) { const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`order_number.ilike.%${t}%,customer_name.ilike.%${t}%,company_name.ilike.%${t}%,customer_email.ilike.%${t}%`); }
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (<>
    <PageHeader title="Orders" description={`${count ?? 0} order(s).`} />
    <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q} placeholder="Search number, customer, email…" className="max-w-xs" />
      <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-44"><option value="">All statuses</option>{["pending", "confirmed", "processing", "ready_for_pickup", "shipped", "delivered", "completed", "cancelled", "refunded"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</NativeSelect>
      <NativeSelect name="pay" defaultValue={sp.pay ?? ""} className="w-44"><option value="">All payments</option>{["unpaid", "partially_paid", "paid", "failed", "refunded"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</NativeSelect><Button variant="secondary">Filter</Button></form>
    <div className="overflow-hidden rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead>Delivery</TableHead><TableHead className="text-end">Total</TableHead><TableHead>Placed</TableHead></TableRow></TableHeader>
      <TableBody>{(data ?? []).map((o) => (
        <TableRow key={o.id}><TableCell><Link href={`/admin/orders/${o.id}`} className="font-mono font-medium hover:text-primary">{o.order_number}</Link></TableCell><TableCell>{o.company_name || o.customer_name}</TableCell><TableCell><StatusBadge status={o.status} /></TableCell><TableCell><StatusBadge status={o.payment_status} /></TableCell><TableCell className="capitalize">{o.delivery_method}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(o.grand_total)}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</TableCell></TableRow>))}
        {!data?.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>}</TableBody></Table></div>
    {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.pay ? { pay: sp.pay } : {}), page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
  </>);
}
