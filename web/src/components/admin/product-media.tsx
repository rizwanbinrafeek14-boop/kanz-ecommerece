"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Star, Trash2, Upload, RefreshCw, FileText, ImageUp, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { Panel } from "./ui";
import { addProductDocument, deleteProductDocument, setPrimaryImage, updateImageMeta } from "@/lib/admin/product-actions";
import { addProductPhoto, deleteProductImage, replaceProductImage, restoreProductImage, setMainPhoto, setPlaceholderKind, type UploadedFile } from "@/lib/admin/image-actions";
import { removeFromBucket, run, uploadProductImage, uploadToBucket } from "@/lib/admin/client";
import { IMAGE_TYPES, kb } from "@/lib/admin/image-optimize";
import { PLACEHOLDER_KINDS, PLACEHOLDER_LABELS, type PlaceholderKind } from "@/lib/images/placeholder";
import { ProductPlaceholder } from "@/components/storefront/product-placeholder";
import { publicUrl } from "@/lib/format";

export interface ImageRow { id: string; storage_path: string; thumb_path?: string | null; is_primary: boolean; needs_hires: boolean; sort_order: number; alt_en: string | null; alt_ar: string | null; option_match?: Record<string, string> | null;
  source?: string | null; kind?: string | null; width?: number | null; height?: number | null; bytes?: number | null; original_name?: string | null; previous_path?: string | null; replaced_at?: string | null }
export interface DocRow { id: string; kind: string; title: string; storage_path: string; is_public: boolean; url: string | null }

const ACCEPT = IMAGE_TYPES.join(",");
const SOURCE: Record<string, { label: string; variant: "success" | "secondary" | "warning" }> = {
  upload: { label: "Your photo", variant: "success" }, catalogue: { label: "Catalogue image (temporary)", variant: "warning" }, manufacturer: { label: "Manufacturer image", variant: "secondary" },
};
const sourceOf = (r: ImageRow) => (r.kind === "drawing" && r.source === "catalogue" ? { label: "Catalogue drawing", variant: "secondary" as const } : SOURCE[r.source ?? "upload"] ?? SOURCE.upload);

/** Optimises, uploads and runs `then` with the stored file; one toast with the size saving. Shared by every image button. */
async function uploadOne(productId: string, f: File, then: (file: UploadedFile) => Promise<unknown>, verb: string) {
  const u = await uploadProductImage(productId, f);
  const r = await run(then(u.file) as Promise<{ ok: true; data: unknown } | { ok: false; error: string }>);
  if (!r) { await removeFromBucket("product-images", [u.file.path, u.file.thumb].filter(Boolean) as string[]); return false; }   // nothing refers to the files
  toast.success(`${verb} — optimised ${kb(u.before)} → ${kb(u.after)}${u.small ? " (small image: marked low-res)" : ""}`);
  return true;
}

/**
 * "Upload / Replace product image": replaces the main image (the product, its variants, stock and links stay as they are),
 * or adds the first image. Used on the product page, in the product list and on the missing-photos list.
 */
export function UploadReplaceButton({ productId, productName, hasImage, size = "default", variant = "default", onDone }: {
  productId: string; productName?: string; hasImage: boolean; size?: "default" | "sm"; variant?: "default" | "outline"; onDone?: () => void;
}) {
  const router = useRouter(); const ref = React.useRef<HTMLInputElement>(null); const [busy, setBusy] = React.useState(false);
  const pick = async (f?: File) => {
    if (!f) return; setBusy(true);
    try { if (await uploadOne(productId, f, (file) => setMainPhoto(productId, file), hasImage ? "Image replaced" : "Image added")) { onDone?.(); router.refresh(); } }
    catch (e) { toast.error((e as Error).message, { duration: 8000 }); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (<>
    <Button type="button" size={size} variant={variant} disabled={busy} onClick={() => ref.current?.click()} data-upload-main={productId}
      aria-label={productName ? `Upload or replace the image of ${productName}` : undefined}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}{busy ? "Optimising…" : "Upload / Replace product image"}
    </Button>
    <input ref={ref} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
  </>);
}

export function ProductImages({ productId, productName, rows, placeholder }: { productId: string; productName: string; rows: ImageRow[]; placeholder: { kind: string | null; auto: PlaceholderKind } }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const addRef = React.useRef<HTMLInputElement>(null);
  const main = rows.find((r) => r.is_primary) ?? rows[0];
  const shown = (placeholder.kind as PlaceholderKind | null) ?? placeholder.auto;
  const addMany = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); let n = 0;
    try { for (const f of Array.from(files)) { try { if (await uploadOne(productId, f, (file) => addProductPhoto(productId, file, { main: false }), `${f.name} added`)) n++; } catch (e) { toast.error((e as Error).message, { duration: 8000 }); } } }
    finally { setBusy(false); if (addRef.current) addRef.current.value = ""; if (n) router.refresh(); }
  };
  const replace = async (id: string, f: File | undefined) => {
    if (!f) return; setBusy(true);
    try { if (await uploadOne(productId, f, (file) => replaceProductImage(productId, id, file), "Image replaced")) router.refresh(); } catch (e) { toast.error((e as Error).message, { duration: 8000 }); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Panel title="Product image">
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]" data-main-image={main ? main.source ?? "upload" : "placeholder"}>
          <div className="overflow-hidden rounded-lg border bg-white">
            {main ? <img src={publicUrl("product-images", main.thumb_path || main.storage_path)!} alt={main.alt_en ?? productName} className="aspect-square w-full object-contain" />
              : <ProductPlaceholder kind={shown} alt={productName} className="aspect-square w-full" />}
          </div>
          <div className="space-y-3 text-sm">
            {!main && <p><Badge variant="secondary">Placeholder</Badge> No image yet. Customers see the drawing on the left, captioned <q>Photo coming soon</q>, on listings and the product page.</p>}
            {main?.source === "catalogue" && <p><Badge variant="warning">Temporary</Badge> {main.kind === "drawing" ? "A drawing" : "An image"} from the manufacturer&apos;s catalogue. Customers see <q>{main.kind === "drawing" ? "Drawing" : "Image"} from the manufacturer&apos;s catalogue</q> under it. Upload your own photo to replace it.</p>}
            {main && main.source !== "catalogue" && <p><Badge variant="success">{sourceOf(main).label}</Badge>{" "}{[main.width && main.height ? `${main.width} × ${main.height} px` : null, main.bytes ? kb(main.bytes) : null, main.original_name ? `from ${main.original_name}` : null].filter(Boolean).join(" · ")}</p>}
            {main?.option_match && <p className="text-xs text-muted-foreground">The main image is only shown for some options; uploading here adds a general main image.</p>}
            <div className="flex flex-wrap gap-2">
              <UploadReplaceButton productId={productId} hasImage={!!main && !main.option_match} />
              {main?.previous_path && <Button variant="outline" onClick={async () => { if (await run(restoreProductImage(productId, main.id), "Previous image restored")) router.refresh(); }}><Undo2 className="size-4" />Restore previous image</Button>}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, AVIF or GIF up to 40 MB. Before it is stored the photo is turned upright, scaled to at most 2000 px, converted to WebP and given a 600 px thumbnail for listings. Replacing keeps the product, variants, stock, brand and family links, alt text and position — the new image appears on the listing, product page, search and quote list straight away, and the previous file can be restored.</p>
            <label className="block max-w-sm space-y-1"><span className="text-xs font-medium">Placeholder while there is no image</span>
              <NativeSelect value={placeholder.kind ?? ""} aria-label="Placeholder while there is no image" onChange={async (e) => { if (await run(setPlaceholderKind(productId, e.target.value || null), "Placeholder saved")) router.refresh(); }}>
                <option value="">Automatic — {PLACEHOLDER_LABELS[placeholder.auto]}</option>
                {PLACEHOLDER_KINDS.map((k) => <option key={k} value={k}>{PLACEHOLDER_LABELS[k]}</option>)}
              </NativeSelect></label>
          </div>
        </div>
      </Panel>
      <Panel title={`All images (${rows.length})`} actions={<>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => addRef.current?.click()}><Upload className="size-4" />{busy ? "Working…" : "Add images"}</Button>
        <input ref={addRef} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => addMany(e.target.files)} /></>}>
      <p className="mb-4 text-sm text-muted-foreground">The starred image is the main one. <Badge variant="warning">low-res</Badge> = too small for a sharp product page — replace it with a larger original. Several files at once for many products: <Link href="/admin/products/images" className="font-medium text-primary underline">Bulk image upload</Link>.</p>
      {!rows.length ? <p className="py-8 text-center text-sm text-muted-foreground">No images yet.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border p-3" data-image-row={r.id}>
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-white"><img src={publicUrl("product-images", r.thumb_path || r.storage_path)!} alt={r.alt_en ?? ""} className="size-full object-contain" />
                {r.is_primary && <Badge className="absolute start-2 top-2">Main</Badge>}{r.needs_hires && <Badge variant="warning" className="absolute end-2 top-2">low-res</Badge>}
                <Badge variant={sourceOf(r).variant} className="absolute bottom-2 start-2">{sourceOf(r).label}</Badge></div>
              <div className="mt-2 grid gap-1.5">
                <label className="text-xs font-medium">Alt text (English)<Input defaultValue={r.alt_en ?? ""} maxLength={200} placeholder="Describe what the image shows" onBlur={async (e) => { const v = e.target.value.trim(); if (v !== (r.alt_en ?? "") && (await run(updateImageMeta(productId, r.id, { alt_en: v || null }), "Alt text saved"))) router.refresh(); }} /></label>
                <label className="text-xs font-medium">Shown for options (e.g. style=SW-IR/CR; empty = always)<Input defaultValue={Object.entries(r.option_match ?? {}).map(([k, v]) => `${k}=${v}`).join("; ")} maxLength={200} onBlur={async (e) => {
                  const m = Object.fromEntries(e.target.value.split(";").map((x) => x.trim()).filter((x) => x.includes("=")).map((x) => [x.slice(0, x.indexOf("=")).trim(), x.slice(x.indexOf("=") + 1).trim()]));
                  const next = Object.keys(m).length ? m : null; if (JSON.stringify(next) !== JSON.stringify(r.option_match ?? null) && (await run(updateImageMeta(productId, r.id, { option_match: next }), "Saved"))) router.refresh(); }} /></label>
                <label className="text-xs font-medium">Alt text (Arabic)<Input dir="rtl" defaultValue={r.alt_ar ?? ""} maxLength={200} onBlur={async (e) => { const v = e.target.value.trim(); if (v !== (r.alt_ar ?? "") && (await run(updateImageMeta(productId, r.id, { alt_ar: v || null }), "Alt text saved"))) router.refresh(); }} /></label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {!r.is_primary && <Button size="sm" variant="outline" onClick={async () => { if (await run(setPrimaryImage(productId, r.id))) router.refresh(); }}><Star className="size-4" />Main</Button>}
                <ReplaceButton disabled={busy} label={`Replace image ${r.alt_en ?? ""}`.trim()} onFile={(f) => replace(r.id, f)} />
                {r.previous_path && <Button size="sm" variant="outline" onClick={async () => { if (await run(restoreProductImage(productId, r.id), "Previous image restored")) router.refresh(); }}><Undo2 className="size-3.5" />Restore</Button>}
                <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={r.needs_hires} onChange={async (e) => { if (await run(updateImageMeta(productId, r.id, { needs_hires: e.target.checked }))) router.refresh(); }} />low-res</label>
                <Button size="icon" variant="ghost" className="ms-auto size-8 text-destructive" aria-label="Delete image" onClick={async () => { if (confirm("Delete this image?") && (await run(deleteProductImage(productId, r.id), "Image deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>
              </div>
            </li>))}
        </ul>
      )}
      </Panel>
    </div>
  );
}

function ReplaceButton({ onFile, disabled, label }: { onFile: (f?: File) => void; disabled?: boolean; label: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (<>
    <Button size="sm" variant="outline" disabled={disabled} aria-label={label} onClick={() => ref.current?.click()}><RefreshCw className="size-3.5" />Replace</Button>
    <input ref={ref} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
  </>);
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
