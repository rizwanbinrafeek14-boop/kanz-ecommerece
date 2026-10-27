"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, FolderOpen, ImagePlus, Loader2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { Panel } from "./ui";
import { removeFromBucket, uploadProductImage } from "@/lib/admin/client";
import { addProductPhoto, findProductsForImage, matchImageFiles, setMainPhoto, type FileMatch, type ProductPick } from "@/lib/admin/image-actions";
import { IMAGE_TYPES, kb } from "@/lib/admin/image-optimize";

type Action = "main" | "gallery" | "skip";
interface Target { id: string; name: string; sku: string | null; has_main: boolean; image_status: string; how: string; value?: string; variant?: Record<string, string> | null; exact?: boolean }
interface Row { key: string; file: File; preview: string; candidates: Target[]; target: Target | null; action: Action; variantOnly: boolean; state: "ready" | "working" | "done" | "error"; message?: string }

const ACTION_LABEL = (t: Target | null): Record<Action, string> => ({
  main: t?.has_main ? "Replace main image" : "Set as main image",
  gallery: "Add as extra image",
  skip: "Skip",
});

/**
 * Chooses each row's default: per product, the file whose name is exactly the code (no "_2" / "-front" suffix) becomes the main
 * image — otherwise the first file in name order — and further files for that product become extra images.
 */
function defaults(rows: Row[]): Row[] {
  const main = new Map<string, string>();
  for (const r of [...rows].sort((a, b) => Number(!!b.target?.exact) - Number(!!a.target?.exact))) if (r.target && !main.has(r.target.id)) main.set(r.target.id, r.key);
  return rows.map((r) => ({ ...r, action: !r.target ? "skip" : main.get(r.target.id) === r.key ? "main" : "gallery" }));
}

export function BulkImageUpload() {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState<"" | "matching" | "uploading">("");
  const [progress, setProgress] = React.useState({ done: 0, total: 0, before: 0, after: 0 });
  const filesRef = React.useRef<HTMLInputElement>(null); const dirRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const previews = React.useRef<string[]>([]);
  const release = () => { previews.current.forEach((u) => URL.revokeObjectURL(u)); previews.current = []; };
  React.useEffect(() => release, []);   // previews are released when new files are chosen, on Clear and when the page closes

  const load = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((f) => IMAGE_TYPES.includes(f.type));
    const skipped = (list?.length ?? 0) - files.length;
    if (skipped > 0) toast.info(`${skipped} file(s) skipped — not an image.`);
    if (!files.length) return;
    if (files.length > 500) { toast.error("Up to 500 images at a time."); return; }
    setBusy("matching");
    const res = await matchImageFiles(files.map((f) => f.name));
    setBusy("");
    if (!res.ok) { toast.error(res.error); return; }
    const byName = new Map<string, FileMatch[]>(); res.data.forEach((m) => byName.set(m.name, [...(byName.get(m.name) ?? []), m]));
    const next: Row[] = files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((f, n) => {
      const ms = byName.get(f.name) ?? [];
      const candidates = ms.map((m) => ({ id: m.product_id, name: m.product_name, sku: m.product_sku, has_main: m.has_main, image_status: m.image_status, how: m.matched_by, value: m.matched_value, variant: m.variant_options, exact: m.exact }));
      return { key: `${n}-${f.name}-${f.size}`, file: f, preview: URL.createObjectURL(f), candidates, target: candidates.length === 1 ? candidates[0] : null, action: "skip", variantOnly: false, state: "ready" };
    });
    release(); previews.current = next.map((r) => r.preview);
    setRows(defaults(next));
  };
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // main images first, so an extra image is never the first image of a product (it would become the main one and then be replaced)
  const todo = rows.filter((r) => r.target && r.action !== "skip" && r.state !== "done").sort((a, b) => Number(b.action === "main") - Number(a.action === "main"));
  const start = async () => {
    setBusy("uploading"); setProgress({ done: 0, total: todo.length, before: 0, after: 0 });
    let ok = 0, bad = 0;
    for (const r of todo) {
      update(r.key, { state: "working", message: undefined });
      try {
        const u = await uploadProductImage(r.target!.id, r.file);
        const res = r.action === "main" && !r.variantOnly ? await setMainPhoto(r.target!.id, u.file)
          // a photo for one configuration only is an extra image shown for that selection, never the product's main image
          : await addProductPhoto(r.target!.id, u.file, { main: r.action === "main" && !r.variantOnly, optionMatch: r.variantOnly ? r.target!.variant ?? null : null });
        if (!res.ok) { await removeFromBucket("product-images", [u.file.path, u.file.thumb].filter(Boolean) as string[]); throw new Error(res.error); }
        update(r.key, { state: "done", message: `${kb(u.before)} → ${kb(u.after)}${u.small ? " · small image (low-res)" : ""}` });
        setProgress((p) => ({ ...p, done: p.done + 1, before: p.before + u.before, after: p.after + u.after }));
        // later files for the same product now see its new main image
        setRows((rs) => rs.map((x) => (x.target?.id === r.target!.id ? { ...x, target: { ...x.target!, has_main: true, image_status: "photo" } } : x)));
        ok++;
      } catch (e) { update(r.key, { state: "error", message: (e as Error).message }); setProgress((p) => ({ ...p, done: p.done + 1 })); bad++; }
    }
    setBusy("");
    if (ok) toast.success(`${ok} image(s) stored${bad ? `, ${bad} failed` : ""}. They are live on the website.`); else if (bad) toast.error(`${bad} image(s) failed.`);
    router.refresh();
  };

  const matched = rows.filter((r) => r.target).length, ambiguous = rows.filter((r) => !r.target && r.candidates.length > 1).length, unmatched = rows.filter((r) => !r.target && !r.candidates.length).length;
  return (
    <div className="space-y-4">
      <Panel title="Bulk image upload">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files); }}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center ${drag ? "border-primary bg-primary/5" : "border-steel-300"}`} data-dropzone>
          <ImagePlus className="size-8 text-steel-500" aria-hidden="true" />
          <p className="max-w-2xl text-sm">Drop photos here, or choose files or a whole folder. Name each file after the product&apos;s <strong>SKU</strong>, a <strong>variant SKU</strong>, the <strong>manufacturer code / reference</strong> or the product&apos;s <strong>URL name</strong> — e.g. <code>KZ-WN-150-4.jpg</code>. Several photos of one product: add <code>_2</code>, <code>-3</code>, <code>(4)</code>, <code>-front</code>… — the first becomes the main image, the others extra images.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" disabled={!!busy} onClick={() => filesRef.current?.click()}><ImagePlus className="size-4" />Choose images</Button>
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => dirRef.current?.click()}><FolderOpen className="size-4" />Choose a folder</Button>
          </div>
          <input ref={filesRef} type="file" multiple accept={IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { load(e.target.files); e.target.value = ""; }} />
          <input ref={dirRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { load(e.target.files); e.target.value = ""; }} {...{ webkitdirectory: "" }} />
          <p className="text-xs text-muted-foreground">Each photo is optimised in your browser (upright, ≤ 2000 px, WebP, 600 px thumbnail) before it is stored. Replacing a main image keeps the product and everything linked to it; the previous image can be restored on the product&apos;s Images tab.</p>
        </div>
        {busy === "matching" && <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Matching file names to products…</p>}
      </Panel>

      {rows.length > 0 && (
        <Panel title={`${rows.length} file${rows.length === 1 ? "" : "s"}`} actions={<div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { release(); setRows([]); }}>Clear</Button>
          <Button size="sm" disabled={!!busy || !todo.length} onClick={start} data-start-upload>{busy === "uploading" ? <Loader2 className="size-4 animate-spin" /> : null}Upload {todo.length} image{todo.length === 1 ? "" : "s"}</Button></div>}>
          <p className="mb-3 text-sm" data-match-summary><span className="font-semibold text-success">{matched} matched</span> · <span className={ambiguous ? "font-semibold text-warning" : ""}>{ambiguous} with several possible products</span> · <span className={unmatched ? "font-semibold text-destructive" : ""}>{unmatched} not matched</span> — choose a product for those, or leave them skipped.</p>
          {busy === "uploading" && <div className="mb-3" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{progress.done} / {progress.total}{progress.before ? ` · ${kb(progress.before)} optimised to ${kb(progress.after)}` : ""}</p></div>}
          <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Files to upload">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/60 text-xs"><tr><th className="p-2 text-start">Image</th><th className="p-2 text-start">File</th><th className="p-2 text-start">Product</th><th className="p-2 text-start">Action</th><th className="p-2 text-start">Status</th></tr></thead>
              <tbody>{rows.map((r) => <FileRow key={r.key} r={r} busy={!!busy} onChange={(p) => update(r.key, p)} />)}</tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function FileRow({ r, busy, onChange }: { r: Row; busy: boolean; onChange: (p: Partial<Row>) => void }) {
  const labels = ACTION_LABEL(r.target);
  return (
    <tr className="border-t align-top" data-file-row={r.file.name} data-state={r.state}>
      <td className="p-2"><img src={r.preview} alt="" className="size-16 rounded border bg-white object-contain" /></td>
      <td className="p-2"><p className="max-w-[220px] break-all font-mono text-xs">{r.file.name}</p><p className="text-xs text-muted-foreground">{kb(r.file.size)}</p></td>
      <td className="p-2">
        {r.target ? (
          <div data-target={r.target.id}>
            <p className="font-medium">{r.target.name}</p>
            <p className="text-xs text-muted-foreground">{r.target.sku ? <span className="me-1 font-mono">{r.target.sku}</span> : null}
              {r.target.how === "chosen by hand" ? "chosen by hand" : <>matched by {r.target.how}{r.target.value ? <> <code>{r.target.value}</code></> : null}</>}
              {" · "}<Badge variant={r.target.image_status === "photo" ? "success" : r.target.image_status === "temporary" ? "warning" : "secondary"}>{r.target.image_status === "photo" ? "has a photo" : r.target.image_status === "temporary" ? "catalogue image" : "placeholder"}</Badge></p>
            {(r.candidates.length > 1 || r.target.how === "chosen by hand") && <button type="button" className="text-xs text-primary underline" disabled={busy} onClick={() => onChange({ target: null, action: "skip" })}>Choose another product</button>}
          </div>
        ) : r.candidates.length > 1 ? (
          <div><p className="flex items-center gap-1 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" />Several products match — choose one:</p>
            <NativeSelect aria-label={`Product for ${r.file.name}`} className="mt-1" value="" disabled={busy} onChange={(e) => { const t = r.candidates.find((c) => c.id === e.target.value); if (t) onChange({ target: t, action: "main" }); }}>
              <option value="">Choose…</option>{r.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sku ? ` (${c.sku})` : ""} — {c.how}</option>)}</NativeSelect></div>
        ) : <ProductFinder file={r.file.name} disabled={busy} onPick={(p) => onChange({ target: { id: p.id, name: p.name_en, sku: p.sku, has_main: p.has_main, image_status: p.image_status, how: "chosen by hand" }, action: "main" })} />}
      </td>
      <td className="p-2">
        <NativeSelect aria-label={`Action for ${r.file.name}`} value={r.action} disabled={busy || !r.target || r.state === "done"} onChange={(e) => onChange({ action: e.target.value as Action })} className="w-48">
          {(["main", "gallery", "skip"] as Action[]).map((a) => <option key={a} value={a}>{labels[a]}</option>)}</NativeSelect>
        {r.target?.variant && r.action !== "skip" && <label className="mt-1 flex items-center gap-1.5 text-xs"><Checkbox checked={r.variantOnly} disabled={busy} onChange={(e) => onChange({ variantOnly: e.target.checked })} />
          Only for {Object.entries(r.target.variant).filter(([, v]) => v !== "na").map(([k, v]) => `${k} ${v}`).join(", ")}</label>}
      </td>
      <td className="p-2 text-xs">
        {r.state === "done" && <p className="flex items-center gap-1 text-success"><CheckCircle2 className="size-4" />Stored · {r.message} {r.target && <Link href={`/admin/products/${r.target.id}?tab=images`} className="text-primary underline">open</Link>}</p>}
        {r.state === "error" && <p className="flex items-center gap-1 text-destructive"><XCircle className="size-4 shrink-0" />{r.message}</p>}
        {r.state === "working" && <p className="flex items-center gap-1"><Loader2 className="size-4 animate-spin" />Optimising and uploading…</p>}
        {r.state === "ready" && <p className="text-muted-foreground">{r.target && r.action !== "skip" ? "Ready" : "Skipped"}</p>}
      </td>
    </tr>);
}

/** Search box to assign an unmatched file to a product by name, SKU or URL name. */
function ProductFinder({ file, disabled, onPick }: { file: string; disabled: boolean; onPick: (p: ProductPick) => void }) {
  const [q, setQ] = React.useState(""); const [res, setRes] = React.useState<ProductPick[] | null>(null);
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => { const r = await findProductsForImage(q); setRes(r.ok ? r.data : []); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="max-w-xs">
      <p className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="size-3.5" />No product matched — find one:</p>
      <div className="relative mt-1"><Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} placeholder="Name or SKU" className="ps-8" aria-label={`Find a product for ${file}`} /></div>
      {res && q.trim().length >= 2 && <ul className="mt-1 max-h-48 overflow-auto rounded-md border bg-popover text-xs">
        {!res.length && <li className="p-2 text-muted-foreground">Nothing found.</li>}
        {res.map((p) => <li key={p.id}><button type="button" className="w-full p-2 text-start hover:bg-accent" onClick={() => { onPick(p); setQ(""); setRes(null); }}>{p.name_en}{p.sku ? <span className="ms-1 font-mono text-muted-foreground">{p.sku}</span> : null}<span className="ms-1 text-muted-foreground">· {p.status}</span></button></li>)}
      </ul>}
    </div>);
}
