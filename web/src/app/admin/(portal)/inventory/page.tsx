import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/admin/ui";
import { InventoryTable, type StockRow } from "@/components/admin/inventory-table";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatSAR } from "@/lib/format";

export const metadata = { title: "Inventory" };
const PAGE = 30;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; wh?: string; page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  const [{ data: whs }, { data: levels }] = await Promise.all([sb.from("warehouses").select("*").eq("is_active", true).order("is_default", { ascending: false }), sb.from("stock_levels").select("variant_id, warehouse_id, on_hand, reserved, reorder_level, avg_cost")]);
  const all = levels ?? [];
  const units = all.reduce((n, l) => n + Number(l.on_hand), 0), reserved = all.reduce((n, l) => n + Number(l.reserved), 0), value = all.reduce((n, l) => n + Number(l.on_hand) * Number(l.avg_cost), 0);
  const lowSet = new Set(all.filter((l) => Number(l.on_hand) - Number(l.reserved) <= Number(l.reorder_level)).map((l) => l.variant_id));
  const lowIds = [...lowSet];

  let q = sb.from("product_variants").select("id, product_id, sku, size, grade, schedule, pressure_class, price, is_active, products!inner(id, name_en, base_price)", { count: "exact" });
  if (sp.q) {
    const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
    if (t) {
      const { data: pm } = await sb.from("products").select("id").ilike("name_en", `%${t}%`).limit(200);
      const pids = (pm ?? []).map((x) => x.id);
      q = q.or(pids.length ? `sku.ilike.%${t}%,product_id.in.(${pids.join(",")})` : `sku.ilike.%${t}%`);
    }
  }
  if (sp.low === "1") q = q.in("id", lowIds.length ? lowIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: vars, count } = await q.order("sku").range((page - 1) * PAGE, page * PAGE - 1);
  const lv = new Map(all.map((l) => [l.variant_id + l.warehouse_id, l]));
  const warehouses = (whs ?? []).filter((w) => !sp.wh || w.id === sp.wh);
  const rows: StockRow[] = (vars ?? []).flatMap((v: any) => warehouses.map((w) => {
    const l = lv.get(v.id + w.id); const p = Array.isArray(v.products) ? v.products[0] : v.products;
    return { variantId: v.id, warehouseId: w.id, warehouse: w.name, product: p?.name_en ?? "", productId: p?.id, sku: v.sku, spec: [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / "), onHand: Number(l?.on_hand ?? 0), reserved: Number(l?.reserved ?? 0), reorder: Number(l?.reorder_level ?? 0), avgCost: Number(l?.avg_cost ?? 0), price: v.price != null ? Number(v.price) : p?.base_price != null ? Number(p.base_price) : null, active: v.is_active };
  }));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (
    <>
      <PageHeader title="Inventory" description="Real-time quantities per variant and warehouse. Stock is reserved when an order is placed and deducted when it ships — overselling is blocked by the database."
        actions={<><Button variant="outline" asChild><Link href="/admin/inventory/movements">Movement history</Link></Button><Button variant="outline" asChild><Link href="/admin/inventory/warehouses">Warehouses</Link></Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Units on hand" value={units.toLocaleString("en-US")} /><Stat label="Reserved for orders" value={reserved.toLocaleString("en-US")} />
        <Stat label="Inventory valuation" value={formatSAR(value)} hint="On-hand × moving-average cost" /><Stat label="Low-stock variants" value={lowSet.size} tone={lowSet.size ? "bad" : undefined} />
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search SKU or product…" className="max-w-xs" />
        <NativeSelect name="wh" defaultValue={sp.wh ?? ""} className="w-48"><option value="">All warehouses</option>{(whs ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
        <NativeSelect name="low" defaultValue={sp.low ?? ""} className="w-44"><option value="">All stock levels</option><option value="1">Low stock only</option></NativeSelect>
        <Button variant="secondary">Filter</Button>
      </form>
      <InventoryTable rows={rows} />
      {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.low ? { low: sp.low } : {}), ...(sp.wh ? { wh: sp.wh } : {}), page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
    </>
  );
}
