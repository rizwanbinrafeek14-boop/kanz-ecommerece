"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload, Percent, Trash2, Eye, EyeOff, Archive, Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { Field } from "./ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkUpdatePrices, deleteProducts, setProductsStatus } from "@/lib/admin/product-actions";
import { applyProductImport, previewProductImport, type ImportRow, type VariantImportRow } from "@/lib/admin/product-import";
import { run } from "@/lib/admin/client";
import { formatSAR } from "@/lib/format";
import { ProductImage } from "@/components/storefront/product-image";
import { UploadReplaceButton } from "./product-media";
import type { PlaceholderKind } from "@/lib/images/placeholder";

export interface ProductRow { id: string; name_en: string; sku: string | null; slug: string; status: string; base_price: number | null; is_quote_only: boolean; category: string | null; image: string | null; image_status: string; has_main: boolean; placeholder: PlaceholderKind; variants: number; available: number | null; updated_at: string; needs_hires: boolean }
const sv = { draft: "warning", published: "success", archived: "secondary" } as const;

export function ProductsTable({ rows, isAdmin }: { rows: ProductRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const ids = [...sel];
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false); setSel(new Set()); router.refresh(); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <span className="text-sm text-muted-foreground">{ids.length} selected</span>
        <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => act(() => run(setProductsStatus(ids, "published"), (d) => `${d.changed} published`))}><Eye className="size-4" />Publish</Button>
        <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => act(() => run(setProductsStatus(ids, "draft"), (d) => `${d.changed} set to draft`))}><EyeOff className="size-4" />Unpublish</Button>
        <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => act(() => run(setProductsStatus(ids, "archived"), (d) => `${d.changed} archived`))}><Archive className="size-4" />Archive</Button>
        <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => setPriceOpen(true)}><Percent className="size-4" />Bulk price update</Button>
        <Button size="sm" variant="outline" className="text-destructive" disabled={busy || !ids.length} onClick={() => { if (confirm(`Delete ${ids.length} product(s)? Drafts can be deleted by staff; published products need an admin. This cannot be undone.`)) act(() => run(deleteProducts(ids), (d) => `${d.deleted} deleted`)); }}><Trash2 className="size-4" />Delete</Button>
        <div className="ms-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Download className="size-4" />Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <DropdownMenuItem asChild><a href="/api/admin/products/export?format=xlsx"><FileSpreadsheet className="size-4" />Excel (.xlsx) — products + variants</a></DropdownMenuItem>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <DropdownMenuItem asChild><a href="/api/admin/products/export?format=csv">CSV — products</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" />Import</Button>
          <Button size="sm" asChild><Link href="/admin/products/new"><Plus className="size-4" />Add product</Link></Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox aria-label="Select all" checked={rows.length > 0 && rows.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></TableHead>
            <TableHead>Product</TableHead><TableHead>Image</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead className="text-end">Price (ex-VAT)</TableHead><TableHead className="text-end">Variants</TableHead><TableHead className="text-end">In stock</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Checkbox aria-label={`Select ${r.name_en}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></TableCell>
                <TableCell><Link href={`/admin/products/${r.id}`} className="flex items-center gap-3 hover:text-primary">
                  <ProductImage path={r.image} alt="" placeholder={r.placeholder} compact className="size-10 shrink-0 rounded border" /><span className="font-medium">{r.name_en}</span>{r.needs_hires && <Badge variant="warning" title="Image is low resolution">low-res</Badge>}
                </Link></TableCell>
                <TableCell><div className="flex flex-col items-start gap-1">
                  <Badge variant={r.image_status === "photo" ? "success" : r.image_status === "temporary" ? "warning" : "secondary"} data-image-status={r.image_status}>{r.image_status === "photo" ? "Photo" : r.image_status === "temporary" ? "Catalogue image" : "Placeholder"}</Badge>
                  <UploadReplaceButton productId={r.id} productName={r.name_en} hasImage={r.has_main} size="sm" variant="outline" /></div></TableCell>
                <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.category ?? "—"}</TableCell>
                <TableCell><Badge variant={sv[r.status as keyof typeof sv]}>{r.status}</Badge></TableCell>
                <TableCell className="text-end tabular-nums">{r.is_quote_only ? <span className="text-muted-foreground">Quote only</span> : r.base_price != null ? formatSAR(r.base_price) : "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{r.variants}</TableCell>
                <TableCell className="text-end tabular-nums">{r.available == null ? "—" : r.available}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No products match. Use <Link href="/admin/import" className="text-primary underline">Import review</Link> to bring in catalogue products, or add one.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <BulkPriceDialog open={priceOpen} onOpenChange={setPriceOpen} ids={ids} onDone={() => { setSel(new Set()); router.refresh(); }} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => router.refresh()} />
      {!isAdmin && <p className="text-xs text-muted-foreground">Staff accounts can delete draft products only.</p>}
    </div>
  );
}

function BulkPriceDialog({ open, onOpenChange, ids, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ids: string[]; onDone: () => void }) {
  const [mode, setMode] = React.useState<"percent" | "amount" | "set">("percent");
  const [value, setValue] = React.useState("5"); const [target, setTarget] = React.useState<"products" | "variants" | "both">("both"); const [round, setRound] = React.useState(false); const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk price update</DialogTitle><DialogDescription>Applies to {ids.length} selected product(s). Products with no price are skipped, never given one (except “set to”). Prices are in SAR excluding VAT.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Change"><NativeSelect value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="percent">Increase / decrease by %</option><option value="amount">Add / subtract an amount (SAR)</option><option value="set">Set to an exact price (SAR)</option></NativeSelect></Field>
          <Field label={`Value ${mode === "percent" ? "(e.g. 5 = +5%, -10 = −10%)" : ""}`}><Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Apply to"><NativeSelect value={target} onChange={(e) => setTarget(e.target.value as typeof target)}><option value="both">Product price and variant prices</option><option value="products">Product (family) price only</option><option value="variants">Variant prices only</option></NativeSelect></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={round} onChange={(e) => setRound(e.target.checked)} />Round to whole riyals</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !ids.length || value === "" || Number.isNaN(Number(value))} onClick={async () => { setBusy(true); const d = await run(bulkUpdatePrices({ ids, mode, value: Number(value), target, round }), (x) => `${x.updated} price(s) updated, ${x.skipped} skipped (no price)`); setBusy(false); if (d) { onOpenChange(false); onDone(); } }}>Apply</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [prev, setPrev] = React.useState<{ products: ImportRow[]; variants: VariantImportRow[] } | null>(null); const [busy, setBusy] = React.useState(false);
  const bad = prev ? prev.products.filter((p) => p.action === "error").length + prev.variants.filter((p) => p.action === "error").length : 0;
  const reset = () => setPrev(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Import products (CSV / Excel)</DialogTitle><DialogDescription>Use the exported file as a template. Columns: slug, sku, name_en, name_ar, category_slug, brand, status, base_price, purchase_cost, unit, min_order_qty, is_quote_only. Excel files may also have a “Variants” sheet. Duplicate SKUs are detected before anything is saved.</DialogDescription></DialogHeader>
        {!prev ? (
          <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); const d = await run(previewProductImport(new FormData(e.currentTarget))); setBusy(false); if (d) setPrev(d); }} className="space-y-3">
            <Input type="file" name="file" accept=".csv,.xlsx" required />
            <Button disabled={busy}>{busy ? "Checking…" : "Check file"}</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{prev.products.filter((p) => p.action === "create").length} new · {prev.products.filter((p) => p.action === "update").length} updates · {prev.variants.length} variant rows · <span className={bad ? "font-semibold text-destructive" : ""}>{bad} with problems (will be skipped)</span></p>
            <div className="max-h-72 overflow-auto rounded-lg border text-xs">
              <table className="w-full"><thead className="bg-muted/60"><tr><th className="p-2 text-start">Line</th><th className="p-2 text-start">Item</th><th className="p-2 text-start">Action</th><th className="p-2 text-start">Problems</th></tr></thead>
                <tbody>{[...prev.products.map((p) => ({ k: "P" + p.line, name: p.name_en || p.sku || "—", a: p.action, pr: p.problems })), ...prev.variants.map((v) => ({ k: "V" + v.line, name: `${v.product_slug} / ${v.sku}`, a: v.action, pr: v.problems }))].slice(0, 400).map((r) => (
                  <tr key={r.k} className="border-t"><td className="p-2">{r.k}</td><td className="p-2">{r.name}</td><td className="p-2"><Badge variant={r.a === "error" ? "destructive" : r.a === "update" ? "info" : "success"}>{r.a}</Badge></td><td className="p-2 text-destructive">{r.pr.join("; ")}</td></tr>))}</tbody></table>
            </div>
            <DialogFooter><Button variant="outline" onClick={reset}>Choose another file</Button>
              <Button disabled={busy} onClick={async () => { setBusy(true); const d = await run(applyProductImport(prev), (x) => `${x.created} created, ${x.updated} updated, ${x.variants} variants, ${x.skipped} skipped`); setBusy(false); if (d) { toast.info("Imported products keep the status in your file — review before publishing."); onOpenChange(false); reset(); onDone(); } }}>Import valid rows</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
