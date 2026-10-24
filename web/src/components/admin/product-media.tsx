"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, Trash2, Upload, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { Panel } from "./ui";
import { addProductDocument, addProductImages, deleteImage, deleteProductDocument, replaceImageFile, setPrimaryImage, updateImageMeta } from "@/lib/admin/product-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { publicUrl } from "@/lib/format";

export interface ImageRow { id: string; storage_path: string; is_primary: boolean; needs_hires: boolean; sort_order: number; alt_en: string | null; alt_ar: string | null }
export interface DocRow { id: string; kind: string; title: string; storage_path: string; is_public: boolean; url: string | null }

export function ProductImages({ productId, rows }: { productId: string; rows: ImageRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try { const paths = []; for (const f of Array.from(files)) paths.push(await uploadToBucket("product-images", f, productId)); if (await run(addProductImages(productId, paths), `${paths.length} image(s) added`)) router.refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const replace = async (id: string, f: File | undefined) => {
    if (!f) return; setBusy(true);
    try { const p = await uploadToBucket("product-images", f, productId); if (await run(replaceImageFile(productId, id, p), "Image replaced")) router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Panel title="Images" actions={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"><Upload className="size-4" />{busy ? "Working…" : "Upload images"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} disabled={busy} /></label>}>
      <p className="mb-4 text-sm text-muted-foreground">JPG, PNG or WebP up to 10 MB. The starred image is the main one. Images marked <Badge variant="warning">low-res</Badge> were cropped from the catalogue — replace them with high-resolution originals.</p>
      {!rows.length ? <p className="py-8 text-center text-sm text-muted-foreground">No images yet.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border p-3">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-white"><img src={publicUrl("product-images", r.storage_path)!} alt={r.alt_en ?? ""} className="size-full object-contain" />
                {r.is_primary && <Badge className="absolute start-2 top-2">Main</Badge>}{r.needs_hires && <Badge variant="warning" className="absolute end-2 top-2">low-res</Badge>}</div>
              <div className="mt-2 grid gap-1.5">
                <label className="text-xs font-medium">Alt text (English)<Input defaultValue={r.alt_en ?? ""} maxLength={200} placeholder="Describe what the image shows" onBlur={async (e) => { const v = e.target.value.trim(); if (v !== (r.alt_en ?? "") && (await run(updateImageMeta(productId, r.id, { alt_en: v || null }), "Alt text saved"))) router.refresh(); }} /></label>
                <label className="text-xs font-medium">Alt text (Arabic)<Input dir="rtl" defaultValue={r.alt_ar ?? ""} maxLength={200} onBlur={async (e) => { const v = e.target.value.trim(); if (v !== (r.alt_ar ?? "") && (await run(updateImageMeta(productId, r.id, { alt_ar: v || null }), "Alt text saved"))) router.refresh(); }} /></label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {!r.is_primary && <Button size="sm" variant="outline" onClick={async () => { if (await run(setPrimaryImage(productId, r.id))) router.refresh(); }}><Star className="size-4" />Main</Button>}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"><RefreshCw className="size-3.5" />Replace<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => replace(r.id, e.target.files?.[0])} /></label>
                <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={r.needs_hires} onChange={async (e) => { if (await run(updateImageMeta(productId, r.id, { needs_hires: e.target.checked }))) router.refresh(); }} />low-res</label>
                <Button size="icon" variant="ghost" className="ms-auto size-8 text-destructive" aria-label="Delete image" onClick={async () => { if (confirm("Delete this image?") && (await run(deleteImage(productId, r.id), "Image deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>
              </div>
            </li>))}
        </ul>
      )}
    </Panel>
  );
}

export function ProductDocs({ productId, rows }: { productId: string; rows: DocRow[] }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<"datasheet" | "mtc" | "certificate" | "other">("datasheet");
  const [title, setTitle] = React.useState(""); const [pub, setPub] = React.useState(true); const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  async function add() {
    const f = fileRef.current?.files?.[0]; if (!f) { toast.error("Choose a PDF or image file."); return; }
    setBusy(true);
    try {
      const isPublic = kind === "mtc" ? false : pub;   // MTCs are never public by default
      const bucket = isPublic ? "product-docs" : "product-mtc";
      const path = await uploadToBucket(bucket, f, productId);
      if (await run(addProductDocument(productId, { kind, title: title || f.name, path, is_public: isPublic }), "Document added")) { setTitle(""); if (fileRef.current) fileRef.current.value = ""; router.refresh(); }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Panel title="Datasheets & test certificates">
      <p className="mb-4 text-sm text-muted-foreground">Public documents (datasheets) are downloadable on the product page. Material test certificates (MTC) are private by default and shown only to staff — send them to customers on request. Never upload a certificate that doesn&apos;t belong to the product.</p>
      <div className="mb-5 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[150px_1fr_1fr_auto]">
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type"><option value="datasheet">Datasheet</option><option value="mtc">MTC (private)</option><option value="certificate">Certificate</option><option value="other">Other</option></NativeSelect>
        <Input placeholder="Title (shown to customers)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="file" ref={fileRef} accept="application/pdf,image/jpeg,image/png" />
        <Button disabled={busy} onClick={add}>Upload</Button>
        {kind !== "mtc" && <label className="flex items-center gap-2 text-sm sm:col-span-4"><Checkbox checked={pub} onChange={(e) => setPub(e.target.checked)} />Visible to customers on the product page</label>}
      </div>
      {!rows.length ? <p className="text-sm text-muted-foreground">No documents.</p> : (
        <ul className="divide-y rounded-lg border">{rows.map((d) => (
          <li key={d.id} className="flex items-center gap-3 p-3 text-sm"><FileText className="size-5 text-primary" />
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.kind}</p></div>
            <Badge variant={d.is_public ? "success" : "secondary"}>{d.is_public ? "public" : "private"}</Badge>
            {d.url && <a className="text-primary underline" href={d.url} target="_blank" rel="noopener noreferrer">Open</a>}
            <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete document" onClick={async () => { if (confirm("Delete this document?") && (await run(deleteProductDocument(productId, d.id, d.is_public ? "product-docs" : "product-mtc", d.storage_path), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>
          </li>))}</ul>
      )}
    </Panel>
  );
}
