"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/input";
import { deleteWarehouse, saveWarehouse } from "@/lib/admin/inventory-actions";
import { run } from "@/lib/admin/client";

export interface WhRow { id: string | null; code: string; name: string; city: string; is_default: boolean; is_active: boolean }
export function WarehouseManager({ rows, canEdit }: { rows: WhRow[]; canEdit: boolean }) {
  const router = useRouter(); const [list, setList] = React.useState(rows);
  const sig = JSON.stringify(rows); const last = React.useRef(sig);
  React.useEffect(() => { if (last.current !== sig) { last.current = sig; setList(rows); } }, [sig, rows]);
  const upd = (i: number, k: keyof WhRow, v: string | boolean) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : k === "is_default" && v ? { ...r, is_default: false } : r)));
  return (
    <div className="space-y-3">
      {!canEdit && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Only administrators can add or change warehouses.</p>}
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Code", "Name", "City", "Default", "Active", ""].map((h) => <th key={h} className="p-2.5 text-start">{h}</th>)}</tr></thead>
        <tbody>{list.map((r, i) => (
          <tr key={r.id ?? `n${i}`} className="border-t">
            <td className="p-2"><Input disabled={!canEdit} value={r.code} onChange={(e) => upd(i, "code", e.target.value)} className="h-8 w-28 font-mono" aria-label="Code" /></td>
            <td className="p-2"><Input disabled={!canEdit} value={r.name} onChange={(e) => upd(i, "name", e.target.value)} className="h-8" aria-label="Name" /></td>
            <td className="p-2"><Input disabled={!canEdit} value={r.city} onChange={(e) => upd(i, "city", e.target.value)} className="h-8" aria-label="City" /></td>
            <td className="p-2"><Checkbox disabled={!canEdit} checked={r.is_default} onChange={(e) => upd(i, "is_default", e.target.checked)} aria-label="Default" /></td>
            <td className="p-2"><Checkbox disabled={!canEdit} checked={r.is_active} onChange={(e) => upd(i, "is_active", e.target.checked)} aria-label="Active" /></td>
            <td className="whitespace-nowrap p-2">{canEdit && <>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Save" onClick={async () => { if (await run(saveWarehouse(r.id, { code: r.code, name: r.name, city: r.city.trim() || null, is_default: r.is_default, is_active: r.is_active }), "Saved")) router.refresh(); }}><Save className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete" onClick={async () => { if (!r.id) { setList((l) => l.filter((_, n) => n !== i)); return; } if (confirm(`Delete warehouse “${r.name}”?`) && (await run(deleteWarehouse(r.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button></>}</td>
          </tr>))}</tbody></table></div>
      {canEdit && <Button variant="outline" onClick={() => setList((l) => [...l, { id: null, code: "", name: "", city: "", is_default: false, is_active: true }])}><Plus className="size-4" />Add warehouse</Button>}
    </div>
  );
}
