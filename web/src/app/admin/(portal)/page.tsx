import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatSAR } from "@/lib/format";
import { PageHeader, Panel, Stat, Empty } from "@/components/admin/ui";
import { SalesChart, HBarList } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const sb = await createClient();
  await sb.rpc("expire_overdue_quotations");
  const [stats, sales, top, orders, rfqs, customers, low] = await Promise.all([
    sb.rpc("admin_dashboard"), sb.rpc("admin_sales_by_day", { p_days: 30 }), sb.rpc("admin_top_products", { p_limit: 5 }),
    sb.from("orders").select("id, order_number, customer_name, grand_total, status, created_at").order("created_at", { ascending: false }).limit(6),
    sb.from("rfqs").select("id, rfq_number, contact_name, company_name, status, created_at").order("created_at", { ascending: false }).limit(6),
    sb.from("profiles").select("id, full_name, company_name, created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(5),
    sb.from("stock_levels").select("variant_id, on_hand, reserved, reorder_level, product_variants(sku, products(name_en))").order("on_hand", { ascending: true }).limit(60),
  ]);
  const s = (stats.data ?? {}) as Record<string, number>;
  const topRows = (top.data ?? []) as { kind: string; name: string; value: number }[];
  const lowRows = ((low.data ?? []) as any[]).filter((r) => Number(r.on_hand) - Number(r.reserved) <= Number(r.reorder_level)).slice(0, 6);
  const chart = ((sales.data ?? []) as { day: string; revenue: number; orders: number }[]).map((d) => ({ day: d.day, revenue: Number(d.revenue), orders: Number(d.orders) }));

  return (
    <>
      <PageHeader title="Dashboard" description="Live figures from your orders, stock and visitor data." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Total revenue" value={formatSAR(s.revenue_total)} hint="Incl. VAT, excl. cancelled/refunded" />
        <Stat label="Sales today" value={formatSAR(s.sales_today)} />
        <Stat label="Sales this month" value={formatSAR(s.sales_month)} />
        <Stat label="Inventory value" value={formatSAR(s.inventory_value)} hint="On-hand × average cost" />
        <Stat label="Products" value={`${s.products_published ?? 0} / ${s.products_total ?? 0}`} hint="published / total" />
        <Stat label="Orders" value={s.orders_total ?? 0} hint={`${s.orders_pending ?? 0} open`} />
        <Stat label="Pending quotations" value={s.rfq_pending ?? 0} tone={s.rfq_pending ? "warn" : undefined} />
        <Stat label="Low-stock products" value={s.low_stock ?? 0} tone={s.low_stock ? "bad" : undefined} />
        <Stat label="Visitors (30 days)" value={s.visitors_30d ?? 0} hint={`${s.visitors_today ?? 0} today`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Daily sales — last 30 days" className="xl:col-span-2"><SalesChart data={chart} /></Panel>
        <Panel title="Most viewed products"><HBarList unit="views" rows={topRows.filter((r) => r.kind === "viewed" && r.value > 0).map((r) => ({ label: r.name, value: Number(r.value) }))} /></Panel>
        <Panel title="Best-selling products"><HBarList unit="units" rows={topRows.filter((r) => r.kind === "sold").map((r) => ({ label: r.name, value: Number(r.value) }))} /></Panel>
        <Panel title="Low stock" actions={<Link href="/admin/inventory" className="text-sm text-primary hover:underline">Inventory</Link>}>
          {lowRows.length ? <ul className="space-y-2 text-sm">{lowRows.map((r: any) => <li key={r.variant_id} className="flex justify-between gap-3"><span className="truncate">{r.product_variants?.products?.name_en} <span className="font-mono text-xs text-muted-foreground">{r.product_variants?.sku}</span></span><Badge variant="destructive">{Number(r.on_hand) - Number(r.reserved)} left</Badge></li>)}</ul> : <Empty>No low-stock items.</Empty>}
        </Panel>
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm text-primary hover:underline">All</Link>}>
          {orders.data?.length ? <ul className="space-y-2 text-sm">{orders.data.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex justify-between gap-3 hover:text-primary"><span className="truncate"><span className="font-mono">{o.order_number}</span> · {o.customer_name}</span><span className="tabular-nums">{formatSAR(o.grand_total)}</span></Link></li>)}</ul> : <Empty>No orders yet.</Empty>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Recent quotation requests" actions={<Link href="/admin/rfqs" className="text-sm text-primary hover:underline">All</Link>}>
          {rfqs.data?.length ? <ul className="space-y-2 text-sm">{rfqs.data.map((r) => <li key={r.id}><Link href={`/admin/rfqs/${r.id}`} className="flex justify-between gap-3 hover:text-primary"><span className="truncate"><span className="font-mono">{r.rfq_number}</span> · {r.company_name || r.contact_name}</span><Badge variant="secondary">{r.status}</Badge></Link></li>)}</ul> : <Empty>No quotation requests yet.</Empty>}
        </Panel>
        <Panel title="Recent customer activity" actions={<Link href="/admin/customers" className="text-sm text-primary hover:underline">All</Link>}>
          {customers.data?.length ? <ul className="space-y-2 text-sm">{customers.data.map((c) => <li key={c.id} className="flex justify-between gap-3"><span>{c.full_name || "—"}{c.company_name && ` · ${c.company_name}`}</span><span className="text-muted-foreground">{formatDateTime(c.created_at)}</span></li>)}</ul> : <Empty>No customers yet.</Empty>}
        </Panel>
      </div>
    </>
  );
}
