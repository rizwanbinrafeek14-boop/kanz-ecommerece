"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Field, Panel } from "./ui";
import { setImportStatus, updateImportItem } from "@/lib/admin/import-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { FLAG_LABEL } from "./import-batch-review";

interface Item { id: string; batch_id: string; status: string; name_en: string; name_ar: string | null; suggested_category_slug: string | null; description_en: string | null; review_note: string | null; specs: Record<string, string[]>; image_path: string | null; flags: string[]; extra: { images?: string[]; document?: { title: string; path: string } | null } }

export function ItemEditor({ item, urls, categories, attributes }: { item: Item; urls: Record<string, string>; categories: { slug: string; name_en: string; parent_id: string | null }[]; attributes: { key: string; name_en: string }[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ name_en: item.name_en, name_ar: item.name_ar ?? "", cat: item.suggested_category_slug ?? "", desc: item.description_en ?? "", note: item.review_note ?? "", image: item.image_path });
  const [specs, setSpecs] = React.useState<Record<string, string>>(Object.fromEntries(attributes.map((a) => [a.key, (item.specs[a.key] ?? []).join("\n")])));
  const [imgUrl, setImgUrl] = React.useState<string | null>(item.image_path ? urls[item.image_path] ?? null : null);
  const [ack, setAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const locked = item.status === "published";
  const flagged = item.flags.includes("foreign_branding");

  const payload = () => ({
    name_en: f.name_en, name_ar: f.name_ar || null, suggested_category_slug: f.cat || null, description_en: f.desc || null, review_note: f.note || null, image_path: f.image,
    specs: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.split("\n").map((x) => x.trim()).filter(Boolean)]).filter(([, v]) => (v as string[]).length)),
  });
  const save = async () => { setBusy(true); const r = await run(updateImportItem(item.id, payload()), "Saved"); setBusy(false); if (r !== undefined) router.refresh(); return r !== undefined; };

  async function replaceImage(file: File) {
    try {
      setBusy(true);
      const p = await uploadToBucket("import-staging", file, item.batch_id);
      setF((x) => ({ ...x, image: p })); setImgUrl(URL.createObjectURL(file));
    } catch (e) { (await import("sonner")).toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Panel title="Image">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-white">{imgUrl ? <img src={imgUrl} alt="" className="size-full object-contain" /> : <span className="text-sm text-muted-foreground">No image</span>}</div>
          {!locked && <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"><Upload className="size-4" />Replace with high-res original<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} /></label>}
          <p className="mt-2 text-xs text-muted-foreground">Cropped from the catalogue ({item.flags.includes("low_res") ? "low resolution" : "ok"}). Remember to Save after replacing.</p>
        </Panel>
        <Panel title="Flags">
          {item.flags.length ? <div className="flex flex-wrap gap-1.5">{item.flags.map((fl) => <Badge key={fl} variant={fl === "foreign_branding" ? "destructive" : fl === "verify_specs" || fl === "not_in_uploaded_pdf" ? "warning" : "secondary"}>{FLAG_LABEL[fl] ?? fl}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No flags.</p>}
          {flagged && <p className="mt-3 flex gap-2 rounded-md bg-red-50 p-2 text-xs text-red-800"><AlertTriangle className="size-4 shrink-0" />This item shows another company&apos;s branding. Replace the image with your own photo, or confirm below that it is acceptable.</p>}
        </Panel>
        {item.review_note && <Panel title="Reviewer notes from extraction"><p className="whitespace-pre-line text-sm text-muted-foreground">{item.review_note}</p></Panel>}
      </div>

      <div className="space-y-4">
        <Panel title="Product details">
          <fieldset disabled={locked || busy} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English)"><Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></Field>
            <Field label="Name (Arabic)" hint={item.flags.includes("ar_draft") ? "Draft translation — have a native speaker confirm." : undefined}><Input dir="rtl" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
            <Field label="Category" className="sm:col-span-2">
              <NativeSelect value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}><option value="">— none —</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.parent_id ? "   ↳ " : ""}{c.name_en}</option>)}</NativeSelect>
            </Field>
            <Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
          </fieldset>
        </Panel>
        <Panel title="Specifications (one value per line)">
          <fieldset disabled={locked || busy} className="grid gap-4 sm:grid-cols-2">
            {attributes.map((a) => <Field key={a.key} label={a.name_en}><Textarea rows={3} value={specs[a.key] ?? ""} onChange={(e) => setSpecs({ ...specs, [a.key]: e.target.value })} className="font-mono text-xs" /></Field>)}
          </fieldset>
        </Panel>
        <Panel title="Your review note"><Textarea rows={2} disabled={locked} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Panel>

        {!locked ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
            {flagged && <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />I checked the third-party branding</label>}
            <div className="ms-auto flex gap-2">
              <Button variant="outline" disabled={busy} onClick={save}>Save</Button>
              <Button variant="outline" disabled={busy} onClick={async () => { if (await run(setImportStatus([item.id], "rejected"), "Rejected")) router.push(`/admin/import/${item.batch_id}`); }}>Reject</Button>
              <Button disabled={busy} onClick={async () => { if (!(await save())) return; const d = await run(setImportStatus([item.id], "approved", ack)); if (d?.changed) { (await import("sonner")).toast.success("Approved"); router.push(`/admin/import/${item.batch_id}`); } else if (d) (await import("sonner")).toast.warning("Tick “I checked the third-party branding” first."); }}>Save & approve</Button>
            </div>
          </div>
        ) : <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">This item has been turned into a draft product.</p>}
      </div>
    </div>
  );
}
