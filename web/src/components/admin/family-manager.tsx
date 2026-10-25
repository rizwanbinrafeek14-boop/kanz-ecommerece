"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ExternalLink, Link2, Trash2, Unlink, Upload, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Field, Panel } from "./ui";
import { run, uploadToBucket } from "@/lib/admin/client";
import { deleteFamily, linkProduct, moveOffering, saveFamily, setOfferingLink, unlinkProduct } from "@/lib/admin/family-actions";
import { ProductImage } from "@/components/storefront/product-image";

export interface FamilyForm {
  id: string; slug: string; name_en: string; name_ar: string; product_type: string; category_id: string; short_desc_en: string; short_desc_ar: string; description_en: string; description_ar: string;
  image_path: string; seo_title_en: string; seo_title_ar: string; seo_desc_en: string; seo_desc_ar: string; seo_noindex: boolean; status: "draft" | "published";
}
export interface OfferingRow { id: string; slug: string; name: string; brand: string; status: string; link: string; variants: number; tables: number; images: number; docs: number; confidence: string | null; reasons: string[] }

const CONF: Record<string, ["success" | "info" | "warning", string]> = { exact: ["success", "exact match"], likely: ["info", "likely - check"], uncertain: ["warning", "uncertain - check carefully"] };

export function SuggestionActions({ productId }: { productId: string }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false);
  const act = async (l: "confirmed" | "rejected") => { setBusy(true); if (await run(setOfferingLink(productId, l), l === "confirmed" ? "Confirmed - shown on the family page once both are published" : "Kept separate")) router.refresh(); setBusy(false); };
  return <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => act("confirmed")}><Check className="size-4" />Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => act("rejected")}><X className="size-4" />Keep separate</Button></div>;
}

export function FamilyEditor({ form, offerings, categories, candidates, isAdmin }: { form: FamilyForm; offerings: OfferingRow[]; categories: { id: string; name: string }[]; candidates: { id: string; label: string }[]; isAdmin: boolean }) {
  const router = useRouter(); const [f, setF] = React.useState(form); const [busy, setBusy] = React.useState(false); const [pick, setPick] = React.useState("");
  const set = <K extends keyof FamilyForm>(k: K, v: FamilyForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const live = offerings.filter((o) => o.link === "confirmed" && o.status === "published").length;
  const save = async (status = f.status) => {
    setBusy(true);
    const r = await run(saveFamily(f.id || null, { ...f, status, category_id: f.category_id || null }), status === "published" ? "Family page published" : "Saved");
    setBusy(false);
    if (r) { set("status", status); if (!f.id) router.push(`/admin/families/${(r as { id: string }).id}`); else router.refresh(); }
  };
  const upload = async (file?: File) => { if (!file) return; try { setBusy(true); set("image_path", await uploadToBucket("product-images", file, "families")); } catch (e) { alert((e as Error).message); } finally { setBusy(false); } };
  const act = async (p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, msg: string) => { if (await run(p, msg)) router.refresh(); };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={f.status === "published" ? "dark" : "outline"}>{f.status}</Badge>
        <span className="text-sm text-muted-foreground">{live} confirmed, published offering{live === 1 ? "" : "s"}</span>
        <div className="ms-auto flex gap-2">
          {f.id && f.status === "published" && <a className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm" href={`/en/product/${f.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />View page</a>}
          <Button variant="outline" disabled={busy} onClick={() => save()}>Save</Button>
          {f.status === "published" ? <Button variant="outline" disabled={busy} onClick={() => save("draft")}>Unpublish</Button> : <Button disabled={busy || !f.id || !live} title={!live ? "Confirm at least one published offering first" : ""} onClick={() => save("published")}>Publish family page</Button>}
        </div>
      </div>

      <Panel title="Family page">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name (English)"><Input value={f.name_en} maxLength={160} onChange={(e) => { set("name_en", e.target.value); if (!form.id && !f.slug) set("slug", ""); }} /></Field>
          <Field label="Name (Arabic)"><Input dir="rtl" value={f.name_ar} maxLength={160} onChange={(e) => set("name_ar", e.target.value)} /></Field>
          <Field label="Address" hint="/en/product/… - lowercase letters, digits, dashes. Must not equal a product address."><Input value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="forged-elbow-90" /></Field>
          <Field label="Category"><NativeSelect value={f.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">-</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <Field label="Product type (internal)"><Input value={f.product_type} maxLength={60} onChange={(e) => set("product_type", e.target.value)} placeholder="elbow" /></Field>
          <Field label="Family photo" hint="Your own photo (JPG/PNG/WebP). Until you upload one, the page shows the selected brand's drawing.">
            <div className="flex items-center gap-3">
              {f.image_path ? <ProductImage bucket="product-images" path={f.image_path} alt="" className="size-16 rounded border" /> : null}
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm"><Upload className="size-4" />Upload<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload family photo" onChange={(e) => upload(e.target.files?.[0])} /></label>
              {f.image_path && <Button size="sm" variant="ghost" onClick={() => set("image_path", "")}>Remove</Button>}
            </div>
          </Field>
          <Field label="Short description (English)"><Textarea rows={2} maxLength={500} value={f.short_desc_en} onChange={(e) => set("short_desc_en", e.target.value)} /></Field>
          <Field label="Short description (Arabic)"><Textarea dir="rtl" rows={2} maxLength={500} value={f.short_desc_ar} onChange={(e) => set("short_desc_ar", e.target.value)} /></Field>
          <Field label="Description (English)"><Textarea rows={5} maxLength={8000} value={f.description_en} onChange={(e) => set("description_en", e.target.value)} /></Field>
          <Field label="Description (Arabic)"><Textarea dir="rtl" rows={5} maxLength={8000} value={f.description_ar} onChange={(e) => set("description_ar", e.target.value)} /></Field>
        </div>
      </Panel>

      <Panel title="SEO">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="SEO title (English)" hint="Empty = generated from the name and brands"><Input maxLength={70} value={f.seo_title_en} onChange={(e) => set("seo_title_en", e.target.value)} /></Field>
          <Field label="SEO title (Arabic)"><Input dir="rtl" maxLength={70} value={f.seo_title_ar} onChange={(e) => set("seo_title_ar", e.target.value)} /></Field>
          <Field label="Meta description (English)"><Textarea rows={2} maxLength={170} value={f.seo_desc_en} onChange={(e) => set("seo_desc_en", e.target.value)} /></Field>
          <Field label="Meta description (Arabic)"><Textarea dir="rtl" rows={2} maxLength={170} value={f.seo_desc_ar} onChange={(e) => set("seo_desc_ar", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.seo_noindex} onChange={(e) => set("seo_noindex", e.target.checked)} />Hide from search engines (noindex)</label>
        </div>
      </Panel>

      {f.id && <Panel title="Manufacturer offerings">
        <p className="mb-3 text-sm text-muted-foreground">Only <strong>confirmed</strong> and <strong>published</strong> offerings appear on the family page; their own product pages then redirect here with that brand selected. Edit sizes, tables, drawings and documents in each product.</p>
        {!offerings.length ? <p className="text-sm text-muted-foreground">No products in this family yet.</p> : (
          <ul className="divide-y rounded-md border">{offerings.map((o, i) => (
            <li key={o.id} className="grid gap-2 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{o.brand}</span><Link href={`/admin/products/${o.id}`} className="text-sm underline">{o.name}</Link>
                  <Badge variant={o.link === "confirmed" ? "success" : o.link === "rejected" ? "destructive" : "warning"}>{o.link === "suggested" ? "waiting for approval" : o.link === "rejected" ? "kept separate" : "confirmed"}</Badge>
                  <Badge variant={o.status === "published" ? "dark" : "outline"}>{o.status}</Badge>
                  {o.link === "suggested" && o.confidence && <Badge variant={CONF[o.confidence][0]}>{CONF[o.confidence][1]}</Badge>}</p>
                <p className="mt-1 text-xs text-muted-foreground">{o.variants} configurations · {o.tables} dimension tables · {o.images} drawings/images · {o.docs} documents</p>
                {o.link === "suggested" && o.reasons.length > 0 && <ul className="mt-1 list-disc ps-5 text-xs text-muted-foreground">{o.reasons.map((r, k) => <li key={k}>{r}</li>)}</ul>}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${o.brand} up`} disabled={i === 0} onClick={() => act(moveOffering(o.id, -1), "Moved")}><ArrowUp className="size-4" /></Button>
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Move ${o.brand} down`} disabled={i === offerings.length - 1} onClick={() => act(moveOffering(o.id, 1), "Moved")}><ArrowDown className="size-4" /></Button>
                {o.link !== "confirmed" && <Button size="sm" onClick={() => act(setOfferingLink(o.id, "confirmed"), "Confirmed")}><Check className="size-4" />Confirm</Button>}
                {o.link !== "rejected" && <Button size="sm" variant="outline" onClick={() => act(setOfferingLink(o.id, "rejected"), "Kept separate")}><X className="size-4" />{o.link === "confirmed" ? "Remove from page" : "Keep separate"}</Button>}
                {o.link === "rejected" && <Button size="sm" variant="outline" onClick={() => act(setOfferingLink(o.id, "suggested"), "Back to suggestions")}><RotateCcw className="size-4" />Reconsider</Button>}
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Take ${o.name} out of this family? The product itself is not changed.`)) act(unlinkProduct(o.id), "Removed from family"); }}><Unlink className="size-4" />Unlink</Button>
              </div>
            </li>))}</ul>)}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Add an existing product to this family" className="min-w-72 flex-1"><NativeSelect value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose a product…</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</NativeSelect></Field>
          <Button variant="outline" disabled={!pick} onClick={async () => { if (await run(linkProduct(f.id, pick), "Added and confirmed")) { setPick(""); router.refresh(); } }}><Link2 className="size-4" />Add</Button>
        </div>
      </Panel>}

      {f.id && isAdmin && <div className="flex justify-end"><Button variant="ghost" className="text-destructive" onClick={async () => { if (confirm("Delete this family page? Its products stay as normal products.") && (await run(deleteFamily(f.id), "Deleted"))) router.push("/admin/families"); }}><Trash2 className="size-4" />Delete family</Button></div>}
    </div>
  );
}
