import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSAR } from "@/lib/format";

export const metadata = { title: "Stock movements" };
const PAGE = 50;
const LABEL: Record<string, string> = { stock_in: "Stock in", stock_out: "Stock out", adjustment: "Adjustment (new count)", reserve: "Reserved", release: "Released", transfer_in: "Transfer in", transfer_out: "Transfer out" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ variant?: string; type?: string; page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  let q = sb.from("stock_movements").select("id, type, quantity, unit_cost, reason, reference, created_at, product_variants(sku, products(name_en)), warehouses(name), profiles(full_name)", { count: "exact" });
  if (sp.variant && /^[0-9a-f-]{36}$/i.test(sp.variant)) q = q.eq("variant_id", sp.variant);
  if (sp.type) q = q.eq("type", sp.type as "stock_in");
  const { data, count } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (
    <>
      <Link href="/admin/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Inventory</Link>
      <PageHeader title="Product movement history" description="Every stock change is recorded and cannot be edited." />
      <form className="mb-4 flex gap-2">{sp.variant && <input type="hidden" name="variant" value={sp.variant} />}
        <NativeSelect name="type" defaultValue={sp.type ?? ""} className="w-52"><option value="">All movement types</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect><Button variant="secondary">Filter</Button>
        {sp.variant && <Button variant="ghost" asChild><Link href="/admin/inventory/movements">Show all variants</Link></Button>}</form>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Product / SKU</TableHead><TableHead>Type</TableHead><TableHead className="text-end">Qty</TableHead><TableHead className="text-end">Unit cost</TableHead><TableHead>Warehouse</TableHead><TableHead>Reference</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
          <TableBody>{(data ?? []).map((m: any) => (
            <TableRow key={m.id}><TableCell className="whitespace-nowrap text-xs">{formatDateTime(m.created_at)}</TableCell>
              <TableCell><p className="font-medium">{m.product_variants?.products?.name_en}</p><p className="font-mono text-xs text-muted-foreground">{m.product_variants?.sku}</p></TableCell>
              <TableCell><Badge variant={m.type === "stock_in" || m.type === "release" ? "success" : m.type === "stock_out" ? "destructive" : "secondary"}>{LABEL[m.type]}</Badge></TableCell>
              <TableCell className="text-end tabular-nums">{Number(m.quantity)}</TableCell><TableCell className="text-end tabular-nums">{m.unit_cost != null ? formatSAR(m.unit_cost) : "—"}</TableCell>
              <TableCell>{m.warehouses?.name}</TableCell><TableCell className="font-mono text-xs">{m.reference ?? "—"}</TableCell><TableCell className="text-xs">{m.profiles?.full_name ?? "system"}</TableCell><TableCell className="max-w-48 truncate text-xs text-muted-foreground">{m.reason ?? ""}</TableCell></TableRow>))}
            {!data?.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No movements yet.</TableCell></TableRow>}</TableBody></Table>
      </div>
      {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: Math.min(pages, 30) }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...(sp.variant ? { variant: sp.variant } : {}), ...(sp.type ? { type: sp.type } : {}), page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
    </>
  );
}
