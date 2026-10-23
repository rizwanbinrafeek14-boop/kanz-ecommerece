"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardEdit, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "./ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setReorderLevel, stockMove } from "@/lib/admin/inventory-actions";
import { run } from "@/lib/admin/client";
import { formatSAR } from "@/lib/format";

export interface StockRow { variantId: string; warehouseId: string; warehouse: string; product: string; productId: string; sku: string; spec: string; onHand: number; reserved: number; reorder: number; avgCost: number; price: number | null; active: boolean }
type Mode = "stock_in" | "stock_out" | "adjustment";
const TITLE: Record<Mode, string> = { stock_in: "Stock in (receive goods)", stock_out: "Stock out (manual issue)", adjustment: "Stock adjustment (stocktake)" };

export function InventoryTable({ rows }: { rows: StockRow[] }) {
  const router = useRouter();
  const [dlg, setDlg] = React.useState<{ row: StockRow; mode: Mode } | null>(null);
  const [qty, setQty] = React.useState(""); const [cost, setCost] = React.useState(""); const [reason, setReason] = React.useState(""); const [ref, setRef] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const open = (row: StockRow, mode: Mode) => { setDlg({ row, mode }); setQty(mode === "adjustment" ? String(row.onHand) : ""); setCost(""); setReason(""); setRef(""); };

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Product / SKU</TableHead><TableHead>Warehouse</TableHead><TableHead className="text-end">On hand</TableHead><TableHead className="text-end">Reserved</TableHead><TableHead className="text-end">Available</TableHead><TableHead className="text-end">Reorder at</TableHead><TableHead className="text-end">Avg cost</TableHead><TableHead className="text-end">Value</TableHead><TableHead className="text-end">Margin</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => {
              const avail = r.onHand - r.reserved; const low = avail <= r.reorder; const margin = r.price != null && r.price > 0 && r.avgCost > 0 ? ((r.price - r.avgCost) / r.price) * 100 : null;
              return (
                <TableRow key={r.variantId + r.warehouseId}>
                  <TableCell><Link href={`/admin/products/${r.productId}`} className="font-medium hover:text-primary">{r.product}</Link><p className="font-mono text-xs text-muted-foreground">{r.sku}{r.spec && ` · ${r.spec}`}{!r.active && " · inactive"}</p></TableCell>
                  <TableCell className="text-muted-foreground">{r.warehouse}</TableCell>
                  <TableCell className="text-end tabular-nums">{r.onHand}</TableCell><TableCell className="text-end tabular-nums">{r.reserved}</TableCell>
                  <TableCell className="text-end tabular-nums"><Badge variant={avail <= 0 ? "destructive" : low ? "warning" : "success"}>{avail}</Badge></TableCell>
                  <TableCell className="text-end"><Input type="number" min={0} defaultValue={r.reorder} className="ms-auto h-8 w-20 text-end" aria-label="Reorder level" onBlur={async (e) => { const v = Number(e.target.value); if (v !== r.reorder && (await run(setReorderLevel(r.variantId, r.warehouseId, v), "Reorder level saved")) !== undefined) router.refresh(); }} /></TableCell>
                  <TableCell className="text-end tabular-nums">{r.avgCost > 0 ? formatSAR(r.avgCost) : "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatSAR(r.onHand * r.avgCost)}</TableCell>
                  <TableCell className="text-end tabular-nums">{margin == null ? "—" : `${margin.toFixed(1)}%`}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="size-8" title="Stock in" aria-label={`Stock in ${r.sku}`} onClick={() => open(r, "stock_in")}><ArrowDownToLine className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8" title="Stock out" aria-label={`Stock out ${r.sku}`} onClick={() => open(r, "stock_out")}><ArrowUpFromLine className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8" title="Adjust" aria-label={`Adjust ${r.sku}`} onClick={() => open(r, "adjustment")}><ClipboardEdit className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8" asChild title="History"><Link href={`/admin/inventory/movements?variant=${r.variantId}`} aria-label={`History ${r.sku}`}><History className="size-4" /></Link></Button>
                  </TableCell>
                </TableRow>);
            })}
            {!rows.length && <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No sellable variants yet. Add variants (with real SKUs) to a product first; stock is tracked per variant.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          {dlg && <>
            <DialogHeader><DialogTitle>{TITLE[dlg.mode]}</DialogTitle><DialogDescription>{dlg.row.product} · <span className="font-mono">{dlg.row.sku}</span> · {dlg.row.warehouse} · on hand {dlg.row.onHand}, reserved {dlg.row.reserved}</DialogDescription></DialogHeader>
            <div className="grid gap-3">
              <Field label={dlg.mode === "adjustment" ? "Counted quantity (new on-hand)" : "Quantity"}><Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
              {dlg.mode === "stock_in" && <Field label="Unit purchase cost (SAR, ex-VAT)" hint="Updates the moving-average cost used for valuation and profit."><Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>}
              <Field label={`Reference ${dlg.mode === "stock_in" ? "(PO / supplier invoice)" : "(optional)"}`}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
              <Field label={`Reason${dlg.mode === "adjustment" ? " *" : ""}`}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button>
              <Button disabled={busy || qty === ""} onClick={async () => { setBusy(true); const r = await run(stockMove({ variantId: dlg.row.variantId, warehouseId: dlg.row.warehouseId, type: dlg.mode, quantity: Number(qty), unitCost: cost === "" ? null : Number(cost), reason: reason || null, reference: ref || null }), "Stock updated"); setBusy(false); if (r !== undefined) { setDlg(null); router.refresh(); } }}>Save</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
