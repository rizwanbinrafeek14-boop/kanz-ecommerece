"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./ui";
import { deleteCategory, saveCategory } from "@/lib/admin/catalog-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { ProductImage } from "@/components/storefront/product-image";

export interface Cat { id: string; parent_id: string | null; slug: string; name_en: string; name_ar: string | null; description_en: string | null; description_ar: string | null; image_path: string | null; sort_order: number; is_active: boolean; is_featured: boolean; seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null; products: number }
const empty = (parent: string | null = null): Cat => ({ id: "", parent_id: parent, slug: "", name_en: "", name_ar: "", description_en: "", description_ar: "", image_path: null, sort_order: 0, is_active: true, is_featured: false, seo_title_en: "", seo_title_ar: "", seo_desc_en: "", seo_desc_ar: "", products: 0 });
const nn = (s: string | null) => (s == null || s.trim() === "" ? null : s.trim());

export function CategoryManager({ cats, isAdmin }: { cats: Cat[]; isAdmin: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<Cat | null>(null); const [busy, setBusy] = React.useState(false);
  const roots = cats.filter((c) => !c.parent_id); const kids = (id: string) => cats.filter((c) => c.parent_id === id);

  async function save() {
    if (!edit) return; setBusy(true);
    const r = await run(saveCategory(edit.id || null, { name_en: edit.name_en, name_ar: nn(edit.name_ar), slug: nn(edit.slug), parent_id: edit.parent_id, description_en: nn(edit.description_en), description_ar: nn(edit.description_ar), image_path: edit.image_path, sort_order: Number(edit.sort_order) || 0, is_active: edit.is_active, is_featured: edit.is_featured, seo_title_en: nn(edit.seo_title_en), seo_title_ar: nn(edit.seo_title_ar), seo_desc_en: nn(edit.seo_desc_en), seo_desc_ar: nn(edit.seo_desc_ar) }), "Category saved");
    setBusy(false); if (r) { setEdit(null); router.refresh(); }
  }
  const row = (c: Cat, depth: number) => (
    <li key={c.id}>
      <div className={`flex items-center gap-3 rounded-lg border bg-card p-2.5 ${depth ? "ms-8" : ""}`}>
        <ProductImage bucket="category-images" path={c.image_path} alt="" className="size-10 shrink-0 rounded border" />
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{c.name_en} {c.name_ar && <span className="text-muted-foreground" dir="rtl">· {c.name_ar}</span>}</p><p className="text-xs text-muted-foreground">/{c.slug} · {c.products} product(s) · order {c.sort_order}</p></div>
        {c.is_featured && <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Featured" />}
        {!c.is_active && <Badge variant="secondary">hidden</Badge>}
        <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${c.name_en}`} onClick={() => setEdit({ ...c })}><Pencil className="size-4" /></Button>
        {depth === 0 && <Button size="icon" variant="ghost" className="size-8" aria-label="Add subcategory" onClick={() => setEdit(empty(c.id))}><Plus className="size-4" /></Button>}
        {isAdmin && <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label={`Delete ${c.name_en}`} onClick={async () => { if (confirm(`Delete “${c.name_en}”? Its products stay but lose their category; subcategories become top-level.`) && (await run(deleteCategory(c.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>}
      </div>
      {depth === 0 && kids(c.id).length > 0 && <ul className="mt-2 space-y-2">{kids(c.id).map((k) => row(k, 1))}</ul>}
    </li>
  );
  const set = (k: keyof Cat) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setEdit((x) => x && ({ ...x, [k]: e.target.value }));

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEdit(empty())}><Plus className="size-4" />Add category</Button></div>
      <ul className="space-y-2">{roots.map((c) => row(c, 0))}</ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name (English) *"><Input value={edit.name_en} onChange={set("name_en")} /></Field>
              <Field label="Name (Arabic)"><Input dir="rtl" value={edit.name_ar ?? ""} onChange={set("name_ar")} /></Field>
              <Field label="Parent category"><NativeSelect value={edit.parent_id ?? ""} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value || null })}><option value="">— top level —</option>{roots.filter((r) => r.id !== edit.id).map((r) => <option key={r.id} value={r.id}>{r.name_en}</option>)}</NativeSelect></Field>
              <Field label="URL slug" hint="Auto-generated if empty."><Input dir="ltr" value={edit.slug} onChange={set("slug")} className="font-mono" /></Field>
              <Field label="Display order"><Input type="number" min={0} value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
              <div className="flex items-end gap-5 pb-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Visible</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.is_featured} onChange={(e) => setEdit({ ...edit, is_featured: e.target.checked })} />Featured on homepage</label></div>
              <Field label="Description (English)" className="sm:col-span-2"><Textarea rows={2} value={edit.description_en ?? ""} onChange={set("description_en")} /></Field>
              <Field label="Description (Arabic)" className="sm:col-span-2"><Textarea rows={2} dir="rtl" value={edit.description_ar ?? ""} onChange={set("description_ar")} /></Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-medium">Image</p>
                <div className="flex items-center gap-3"><ProductImage bucket="category-images" path={edit.image_path} alt="" className="size-16 rounded border" />
                  <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">Upload<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const p = await uploadToBucket("category-images", f, edit.id || "new"); setEdit((x) => x && ({ ...x, image_path: p })); } catch (er) { toast.error((er as Error).message); } }} /></label>
                  {edit.image_path && <Button variant="ghost" size="sm" onClick={() => setEdit({ ...edit, image_path: null })}>Remove</Button>}</div>
              </div>
              <Field label="SEO title (English)"><Input value={edit.seo_title_en ?? ""} onChange={set("seo_title_en")} /></Field>
              <Field label="SEO title (Arabic)"><Input dir="rtl" value={edit.seo_title_ar ?? ""} onChange={set("seo_title_ar")} /></Field>
              <Field label="Meta description (English)"><Textarea rows={2} value={edit.seo_desc_en ?? ""} onChange={set("seo_desc_en")} /></Field>
              <Field label="Meta description (Arabic)"><Textarea rows={2} dir="rtl" value={edit.seo_desc_ar ?? ""} onChange={set("seo_desc_ar")} /></Field>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={busy || !edit?.name_en.trim()} onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
