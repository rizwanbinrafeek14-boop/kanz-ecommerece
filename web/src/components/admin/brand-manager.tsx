"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Checkbox } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./ui";
import { deleteBrand, saveBrand } from "@/lib/admin/catalog-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { ProductImage } from "@/components/storefront/product-image";

export interface BrandRow { id: string; name: string; name_ar: string | null; website: string | null; logo_path: string | null; sort_order: number; is_active: boolean; show_on_homepage: boolean }
const empty = (): BrandRow => ({ id: "", name: "", name_ar: "", website: "", logo_path: null, sort_order: 0, is_active: true, show_on_homepage: false });
const nn = (s: string | null) => (s == null || s.trim() === "" ? null : s.trim());

export function BrandManager({ brands, isAdmin }: { brands: BrandRow[]; isAdmin: boolean }) {
  const router = useRouter(); const [edit, setEdit] = React.useState<BrandRow | null>(null); const [busy, setBusy] = React.useState(false);
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEdit(empty())}><Plus className="size-4" />Add brand</Button></div>
      {!brands.length ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No brands yet. Brand logos shown on the homepage come from here — add only brands you are authorised to display.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{brands.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <ProductImage bucket="brand-logos" path={b.logo_path} alt={b.name} className="size-14 shrink-0 rounded border" />
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{b.name}</p><div className="mt-1 flex gap-1">{b.show_on_homepage && <Badge variant="info">homepage</Badge>}{!b.is_active && <Badge variant="secondary">hidden</Badge>}</div></div>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${b.name}`} onClick={() => setEdit({ ...b })}><Pencil className="size-4" /></Button>
            {isAdmin && <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label={`Delete ${b.name}`} onClick={async () => { if (confirm(`Delete brand “${b.name}”?`) && (await run(deleteBrand(b.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>}
          </li>))}</ul>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit brand" : "New brand"}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3">
            <Field label="Name *"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Name (Arabic)"><Input dir="rtl" value={edit.name_ar ?? ""} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
            <Field label="Website"><Input dir="ltr" placeholder="https://" value={edit.website ?? ""} onChange={(e) => setEdit({ ...edit, website: e.target.value })} /></Field>
            <div className="flex items-center gap-3"><ProductImage bucket="brand-logos" path={edit.logo_path} alt="" className="size-14 rounded border" />
              <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">Upload logo<input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const p = await uploadToBucket("brand-logos", f, "logos"); setEdit((x) => x && ({ ...x, logo_path: p })); } catch (er) { toast.error((er as Error).message); } }} /></label></div>
            <Field label="Display order"><Input type="number" min={0} value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
            <div className="flex gap-5"><label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Active</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.show_on_homepage} onChange={(e) => setEdit({ ...edit, show_on_homepage: e.target.checked })} />Show logo on homepage</label></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={busy || !edit?.name.trim()} onClick={async () => { if (!edit) return; setBusy(true); const r = await run(saveBrand(edit.id || null, { name: edit.name, name_ar: nn(edit.name_ar), website: nn(edit.website), logo_path: edit.logo_path, sort_order: Number(edit.sort_order) || 0, is_active: edit.is_active, show_on_homepage: edit.show_on_homepage }), "Brand saved"); setBusy(false); if (r) { setEdit(null); router.refresh(); } }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
