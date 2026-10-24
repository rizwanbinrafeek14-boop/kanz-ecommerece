import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, Stat } from "@/components/admin/ui";
import { CsvButton } from "@/components/admin/csv-button";
import { LineTrend, SalesChart } from "@/components/admin/charts";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatSAR } from "@/lib/format";

export const metadata = { title: "Reports" };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const defaultFrom = () => iso(new Date(Date.now() - 29 * 864e5));
const today = () => iso(new Date());
const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; group?: string }> }) {
  const sp = await searchParams; const sb = await createClient();
  const to = valid(sp.to) ?? today(); const from = valid(sp.from) ?? defaultFrom(); const group = sp.group === "month" ? "month" : "day";
  const range = { p_from: from, p_to: to };
  const [sales, byProd, byCat, traffic, searches, funnel, banners, stock] = await Promise.all([
    sb.rpc("admin_sales_report", { ...range, p_group: group }), sb.rpc("admin_sales_by_product", { ...range, p_limit: 50 }), sb.rpc("admin_sales_by_category", range), sb.rpc("admin_traffic", range),
    sb.rpc("admin_top_searches", { ...range, p_limit: 20 }), sb.rpc("admin_rfq_funnel", range), sb.from("banners").select("title_en, placement, impressions, clicks, is_active").order("impressions", { ascending: false }),
    sb.from("stock_levels").select("on_hand, avg_cost, product_variants(sku, products(name_en))"),
  ]);
  const s = ((sales.data ?? []) as any[]).map((r) => ({ period: r.period, orders: Number(r.orders), subtotal: Number(r.subtotal), vat: Number(r.vat), total: Number(r.total), paid: Number(r.paid) }));
  const tot = s.reduce((a, r) => ({ orders: a.orders + r.orders, subtotal: a.subtotal + r.subtotal, vat: a.vat + r.vat, total: a.total + r.total, paid: a.paid + r.paid }), { orders: 0, subtotal: 0, vat: 0, total: 0, paid: 0 });
  const prods = ((byProd.data ?? []) as any[]).map((r) => ({ product: r.name, sku: r.sku ?? "", units: Number(r.units), revenue: Number(r.revenue), cost: Number(r.cost), profit: Number(r.profit) }));
  const cats = ((byCat.data ?? []) as any[]).map((r) => ({ category: r.category, units: Number(r.units), revenue: Number(r.revenue) }));
  const tr = ((traffic.data ?? []) as any[]).map((r) => ({ day: r.day, visitors: Number(r.visitors), page_views: Number(r.page_views), product_views: Number(r.product_views), searches: Number(r.searches), whatsapp_clicks: Number(r.whatsapp_clicks), rfq_submits: Number(r.rfq_submits), phone_clicks: Number(r.phone_clicks ?? 0), datasheet_downloads: Number(r.datasheet_downloads ?? 0) }));
  const visitors = new Set<number>(); void visitors;
  const valuation = ((stock.data ?? []) as any[]).map((r) => ({ sku: r.product_variants?.sku, product: r.product_variants?.products?.name_en, on_hand: Number(r.on_hand), avg_cost: Number(r.avg_cost), value: Number(r.on_hand) * Number(r.avg_cost) })).filter((r) => r.on_hand > 0);
  const bn = ((banners.data ?? []) as any[]).map((b) => ({ banner: b.title_en ?? "(untitled)", placement: b.placement, active: b.is_active, impressions: Number(b.impressions), clicks: Number(b.clicks), ctr_percent: b.impressions ? Number(((b.clicks / b.impressions) * 100).toFixed(2)) : 0 }));
  const fn = ((funnel.data ?? []) as any[]).map((r) => ({ status: r.status, count: Number(r.n), quoted_value: Number(r.quoted_value) }));

  return (<>
    <PageHeader title="Reports" description="Every number is calculated from real orders, stock and visitor events in the selected period (Saudi time)." />
    <form className="mb-6 flex flex-wrap items-end gap-2">
      <label className="text-sm">From<Input type="date" name="from" defaultValue={from} className="mt-1" /></label><label className="text-sm">To<Input type="date" name="to" defaultValue={to} className="mt-1" /></label>
      <label className="text-sm">Group by<NativeSelect name="group" defaultValue={group} className="mt-1 w-32"><option value="day">Day</option><option value="month">Month</option></NativeSelect></label><Button variant="secondary">Apply</Button></form>
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5"><Stat label="Orders" value={tot.orders} /><Stat label="Sales ex-VAT" value={formatSAR(tot.subtotal)} /><Stat label="VAT collected" value={formatSAR(tot.vat)} /><Stat label="Sales incl. VAT" value={formatSAR(tot.total)} /><Stat label="Payments received" value={formatSAR(tot.paid)} /></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title={`Sales by ${group}`} actions={<CsvButton filename={`sales-${from}_${to}.csv`} rows={s} />}>
        <SalesChart data={s.map((r) => ({ day: String(r.period), revenue: r.total, orders: r.orders }))} />
        <div className="mt-4 max-h-64 overflow-auto"><Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-end">Orders</TableHead><TableHead className="text-end">Ex-VAT</TableHead><TableHead className="text-end">VAT</TableHead><TableHead className="text-end">Total</TableHead></TableRow></TableHeader>
          <TableBody>{s.filter((r) => r.orders > 0).map((r) => <TableRow key={r.period}><TableCell>{r.period}</TableCell><TableCell className="text-end">{r.orders}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.subtotal)}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.vat)}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.total)}</TableCell></TableRow>)}{!tot.orders && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sales in this period.</TableCell></TableRow>}</TableBody></Table></div></Panel>
      <Panel title="Visitors per day" actions={<CsvButton filename={`traffic-${from}_${to}.csv`} rows={tr} />}>
        <LineTrend data={tr} keys={[{ key: "visitors", label: "Visitors" }]} />
        <p className="mt-2 text-sm text-muted-foreground">{tr.reduce((n, r) => n + r.page_views, 0).toLocaleString("en-US")} page views · {tr.reduce((n, r) => n + r.product_views, 0).toLocaleString("en-US")} product views · {tr.reduce((n, r) => n + r.searches, 0)} searches · {tr.reduce((n, r) => n + r.whatsapp_clicks, 0)} WhatsApp clicks · {tr.reduce((n, r) => n + r.phone_clicks, 0)} phone clicks · {tr.reduce((n, r) => n + r.datasheet_downloads, 0)} datasheet downloads · {tr.reduce((n, r) => n + r.rfq_submits, 0)} RFQs submitted. Daily visitor counts are distinct anonymous sessions (no IP stored).</p></Panel>
      <Panel title="Sales & profit by product" actions={<CsvButton filename={`products-${from}_${to}.csv`} rows={prods} />}>
        <div className="max-h-80 overflow-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-end">Units</TableHead><TableHead className="text-end">Revenue</TableHead><TableHead className="text-end">Profit*</TableHead></TableRow></TableHeader>
          <TableBody>{prods.map((r) => <TableRow key={r.product + r.sku}><TableCell>{r.product}<span className="block font-mono text-xs text-muted-foreground">{r.sku}</span></TableCell><TableCell className="text-end">{r.units}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.revenue)}</TableCell><TableCell className="text-end tabular-nums">{r.cost > 0 ? formatSAR(r.profit) : "—"}</TableCell></TableRow>)}{!prods.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No sales.</TableCell></TableRow>}</TableBody></Table></div>
        <p className="mt-2 text-xs text-muted-foreground">*Profit = revenue (ex-VAT) minus purchase cost; shown only where a cost was known when the order was placed.</p></Panel>
      <Panel title="Sales by category" actions={<CsvButton filename={`categories-${from}_${to}.csv`} rows={cats} />}>
        <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-end">Units</TableHead><TableHead className="text-end">Revenue (ex-VAT)</TableHead></TableRow></TableHeader><TableBody>{cats.map((r) => <TableRow key={r.category}><TableCell>{r.category}</TableCell><TableCell className="text-end">{r.units}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.revenue)}</TableCell></TableRow>)}{!cats.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sales.</TableCell></TableRow>}</TableBody></Table></Panel>
      <Panel title="Quotation requests (RFQ)" actions={<CsvButton filename={`rfq-${from}_${to}.csv`} rows={fn} />}>
        <Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-end">Requests</TableHead><TableHead className="text-end">Quoted value</TableHead></TableRow></TableHeader><TableBody>{fn.map((r) => <TableRow key={r.status}><TableCell className="capitalize">{r.status.replace(/_/g, " ")}</TableCell><TableCell className="text-end">{r.count}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.quoted_value)}</TableCell></TableRow>)}{!fn.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No requests.</TableCell></TableRow>}</TableBody></Table>
        <h3 className="mb-2 mt-5 text-sm font-semibold">Top searches</h3>{(searches.data as any[] | null)?.length ? <ul className="flex flex-wrap gap-2">{(searches.data as any[]).map((r) => <li key={r.query} className="rounded-full border px-3 py-1 text-sm">{r.query} <span className="text-muted-foreground">×{Number(r.n)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No searches yet.</p>}</Panel>
      <Panel title="Banner performance" actions={<CsvButton filename="banners.csv" rows={bn} />}>
        <Table><TableHeader><TableRow><TableHead>Banner</TableHead><TableHead>Placement</TableHead><TableHead className="text-end">Impressions</TableHead><TableHead className="text-end">Clicks</TableHead><TableHead className="text-end">CTR</TableHead></TableRow></TableHeader><TableBody>{bn.map((b, i) => <TableRow key={i}><TableCell>{b.banner}</TableCell><TableCell className="text-xs">{b.placement}</TableCell><TableCell className="text-end">{b.impressions.toLocaleString("en-US")}</TableCell><TableCell className="text-end">{b.clicks.toLocaleString("en-US")}</TableCell><TableCell className="text-end">{b.ctr_percent}%</TableCell></TableRow>)}{!bn.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No banners.</TableCell></TableRow>}</TableBody></Table><p className="mt-2 text-xs text-muted-foreground">Lifetime totals per banner.</p></Panel>
      <Panel title={`Stock valuation — ${formatSAR(valuation.reduce((n, r) => n + r.value, 0))}`} actions={<CsvButton filename="stock-valuation.csv" rows={valuation} />}>
        <div className="max-h-64 overflow-auto"><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead className="text-end">On hand</TableHead><TableHead className="text-end">Avg cost</TableHead><TableHead className="text-end">Value</TableHead></TableRow></TableHeader><TableBody>{valuation.map((r) => <TableRow key={r.sku}><TableCell>{r.product}<span className="block font-mono text-xs text-muted-foreground">{r.sku}</span></TableCell><TableCell className="text-end">{r.on_hand}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.avg_cost)}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(r.value)}</TableCell></TableRow>)}{!valuation.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No stock on hand.</TableCell></TableRow>}</TableBody></Table></div></Panel>
    </div></>);
}
