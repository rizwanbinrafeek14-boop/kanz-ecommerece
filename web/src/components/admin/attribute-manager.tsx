"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/input";
import { deleteAttribute, saveAttribute } from "@/lib/admin/catalog-actions";
import { run } from "@/lib/admin/client";

export interface AttrRow { id: string | null; key: string; name_en: string; name_ar: string; is_filterable: boolean; show_in_specs: boolean; sort_order: number }

export function AttributeManager({ rows, isAdmin }: { rows: AttrRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [list, setList] = React.useState(rows);
  const sig = JSON.stringify(rows); const last = React.useRef(sig);
  React.useEffect(() => { if (last.current !== sig) { last.current = sig; setList(rows); } }, [sig, rows]);
  const upd = (i: number, k: keyof AttrRow, v: string | number | boolean) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Attributes describe products (size, grade, schedule, pressure class, standard…). Those marked <strong>Filter</strong> become filters on category and search pages; those marked <strong>Specs</strong> appear in the product specification table.</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Key", "Name (English)", "Name (Arabic)", "Order", "Filter", "Specs", ""].map((h) => <th key={h} className="p-2.5 text-start">{h}</th>)}</tr></thead>
          <tbody>{list.map((r, i) => (
            <tr key={r.id ?? `n${i}`} className="border-t">
              <td className="p-2"><Input value={r.key} disabled={!!r.id} onChange={(e) => upd(i, "key", e.target.value)} className="h-8 w-36 font-mono text-xs" aria-label="Key" /></td>
              <td className="p-2"><Input value={r.name_en} onChange={(e) => upd(i, "name_en", e.target.value)} className="h-8" aria-label="Name" /></td>
              <td className="p-2"><Input dir="rtl" value={r.name_ar} onChange={(e) => upd(i, "name_ar", e.target.value)} className="h-8" aria-label="Arabic name" /></td>
              <td className="p-2"><Input type="number" value={r.sort_order} onChange={(e) => upd(i, "sort_order", Number(e.target.value))} className="h-8 w-20" aria-label="Order" /></td>
              <td className="p-2"><Checkbox checked={r.is_filterable} onChange={(e) => upd(i, "is_filterable", e.target.checked)} aria-label="Filterable" /></td>
              <td className="p-2"><Checkbox checked={r.show_in_specs} onChange={(e) => upd(i, "show_in_specs", e.target.checked)} aria-label="Show in specs" /></td>
              <td className="whitespace-nowrap p-2">
                <Button size="icon" variant="ghost" className="size-8" aria-label="Save" onClick={async () => { if (await run(saveAttribute(r.id, { key: r.key, name_en: r.name_en, name_ar: r.name_ar.trim() || null, is_filterable: r.is_filterable, show_in_specs: r.show_in_specs, sort_order: r.sort_order }), "Saved")) router.refresh(); }}><Save className="size-4" /></Button>
                {(isAdmin || !r.id) && <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete" onClick={async () => { if (!r.id) { setList((l) => l.filter((_, n) => n !== i)); return; } if (confirm(`Delete attribute “${r.name_en}”? Its values are removed from all products.`) && (await run(deleteAttribute(r.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>}
              </td>
            </tr>))}</tbody>
        </table>
      </div>
      <Button variant="outline" onClick={() => setList((l) => [...l, { id: null, key: "", name_en: "", name_ar: "", is_filterable: true, show_in_specs: true, sort_order: (l.at(-1)?.sort_order ?? 0) + 10 }])}><Plus className="size-4" />Add attribute</Button>
    </div>
  );
}
