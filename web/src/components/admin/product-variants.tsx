"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/input";
import { Panel } from "./ui";
import { deleteVariant, saveVariant } from "@/lib/admin/product-actions";
import { run } from "@/lib/admin/client";

export interface VariantRow { id: string | null; sku: string; barcode: string; label_en: string; label_ar: string; size: string; grade: string; schedule: string; pressure_class: string; material: string; price: string; purchase_cost: string; is_active: boolean; available: number | null }
const blank = (): VariantRow => ({ id: null, sku: "", barcode: "", label_en: "", label_ar: "", size: "", grade: "", schedule: "", pressure_class: "", material: "", price: "", purchase_cost: "", is_active: true, available: null });
const nn = (s: string) => (s.trim() === "" ? null : s.trim());

export function ProductVariants({ productId, rows }: { productId: string; rows: VariantRow[] }) {
  const router = useRouter();
  const [list, setList] = React.useState<VariantRow[]>(rows);
  const [busy, setBusy] = React.useState<number | null>(null);
  // Re-sync from the server only when the saved data really changed, so a refresh never wipes unsaved rows.
  const sig = JSON.stringify(rows); const lastSig = React.useRef(sig);
  React.useEffect(() => { if (lastSig.current !== sig) { lastSig.current = sig; setList(rows); } }, [sig, rows]);
  const upd = (i: number, k: keyof VariantRow, v: string | boolean) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  async function save(i: number) {
    const r = list[i]; setBusy(i);
    const d = await run(saveVariant(productId, r.id, { sku: r.sku, barcode: nn(r.barcode), label_en: nn(r.label_en), label_ar: nn(r.label_ar), size: nn(r.size), grade: nn(r.grade), schedule: nn(r.schedule), pressure_class: nn(r.pressure_class), material: nn(r.material), price: r.price === "" ? null : Number(r.price), purchase_cost: r.purchase_cost === "" ? null : Number(r.purchase_cost), is_active: r.is_active }), "Variant saved");
    setBusy(null); if (d) router.refresh();
  }
  async function remove(i: number) {
    const r = list[i];
    if (!r.id) { setList((l) => l.filter((_, n) => n !== i)); return; }
    if (!confirm(`Delete variant ${r.sku}?`)) return;
    if (await run(deleteVariant(productId, r.id), "Variant deleted")) router.refresh();
  }
  const cell = (i: number, k: keyof VariantRow, w: string, type = "text") => <Input type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? 0 : undefined} value={list[i][k] as string} onChange={(e) => upd(i, k, e.target.value)} className={`h-8 ${w} text-xs`} aria-label={k} />;

  return (
    <Panel title="Variants (sellable SKUs)" actions={<Button size="sm" onClick={() => setList((l) => [...l, blank()])}><Plus className="size-4" />Add variant</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">Each variant is one sellable size/grade/schedule combination with its own unique SKU, price and stock. Add variants only when real SKUs exist — until then the product stays a quotation-only family. Stock is managed in <strong>Inventory</strong>.</p>
      {!list.length ? <p className="py-6 text-center text-sm text-muted-foreground">No variants. This product is a family: customers request a quotation.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr>{["SKU *", "Label", "Size", "Grade", "Schedule", "Pressure", "Price (SAR)", "Cost (SAR)", "Barcode", "Active", "Stock", ""].map((h) => <th key={h} className="p-1.5 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody>{list.map((r, i) => (
              <tr key={r.id ?? `new-${i}`} className="border-t align-top">
                <td className="p-1.5">{cell(i, "sku", "w-32 font-mono")}</td><td className="p-1.5">{cell(i, "label_en", "w-36")}</td><td className="p-1.5">{cell(i, "size", "w-20")}</td><td className="p-1.5">{cell(i, "grade", "w-20")}</td>
                <td className="p-1.5">{cell(i, "schedule", "w-20")}</td><td className="p-1.5">{cell(i, "pressure_class", "w-20")}</td><td className="p-1.5">{cell(i, "price", "w-24", "number")}</td><td className="p-1.5">{cell(i, "purchase_cost", "w-24", "number")}</td>
                <td className="p-1.5">{cell(i, "barcode", "w-28 font-mono")}</td>
                <td className="p-1.5 pt-3"><Checkbox checked={r.is_active} onChange={(e) => upd(i, "is_active", e.target.checked)} aria-label="Active" /></td>
                <td className="p-1.5 pt-3 tabular-nums text-xs">{r.available ?? "—"}</td>
                <td className="whitespace-nowrap p-1.5"><Button size="icon" variant="ghost" className="size-8" disabled={busy === i} onClick={() => save(i)} aria-label="Save variant"><Save className="size-4" /></Button><Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remove(i)} aria-label="Delete variant"><Trash2 className="size-4" /></Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
