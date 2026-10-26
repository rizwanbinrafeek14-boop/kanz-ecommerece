"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, Panel } from "./ui";
import { saveProductGeneral, saveProductPricing, setProductsStatus } from "@/lib/admin/product-actions";
import { run } from "@/lib/admin/client";
import { formatSAR } from "@/lib/format";
import { ProductVariants, type VariantRow } from "./product-variants";
import { ProductAttributes, type AttrDef, type AttrValue } from "./product-attributes";
import { ProductImages, ProductDocs, type ImageRow, type DocRow } from "./product-media";
import { SeoTab } from "./product-seo";
import { ProductCerts, type CertOption, type VariantOption } from "./product-certs";
import type { Assignment } from "@/lib/admin/cert-actions";
import { ProductRelations, type RelRow } from "./product-relations";
import { ProductMaterials, type MaterialRow, type MaterialType } from "./material-manager";

export interface ProductFull {
  id: string; slug: string; sku: string | null; barcode: string | null; name_en: string; name_ar: string | null; short_desc_en: string | null; short_desc_ar: string | null; description_en: string | null; description_ar: string | null;
  category_id: string | null; brand_id: string | null; status: "draft" | "published" | "archived"; is_quote_only: boolean; is_featured: boolean; is_new_arrival: boolean; is_special_offer: boolean; offer_label_en: string | null; offer_label_ar: string | null;
  base_price: number | null; compare_at_price: number | null; unit: string; min_order_qty: number; seo_title_en: string | null; seo_title_ar: string | null; seo_desc_en: string | null; seo_desc_ar: string | null; og_title_en: string | null; og_title_ar: string | null; og_desc_en: string | null; og_desc_ar: string | null; og_image_path: string | null; seo_noindex: boolean; source_page: number | null; purchase_cost: number | null;
}
interface Opt { id: string; name: string; parent_id?: string | null }

export function ProductEditor(props: {
  product: ProductFull | null; categories: Opt[]; brands: Opt[]; variants: VariantRow[]; attrDefs: AttrDef[]; attrValues: AttrValue[]; images: ImageRow[]; docs: DocRow[]; related: RelRow[]; alternatives: RelRow[]; isAdmin: boolean; certOptions: CertOption[]; assignments: Assignment[]; variantOptions: VariantOption[];
  materials?: MaterialRow[]; materialTypes?: MaterialType[]; variantMaterials?: { id: string; label: string; material_code: string | null }[]; initialTab?: string;
}) {
  const { product: p } = props;
  const router = useRouter();
  const [g, setG] = React.useState({
    name_en: p?.name_en ?? "", name_ar: p?.name_ar ?? "", slug: p?.slug ?? "", sku: p?.sku ?? "", barcode: p?.barcode ?? "", category_id: p?.category_id ?? "", brand_id: p?.brand_id ?? "", status: p?.status ?? "draft",
    is_featured: p?.is_featured ?? false, is_new_arrival: p?.is_new_arrival ?? false, is_special_offer: p?.is_special_offer ?? false, offer_label_en: p?.offer_label_en ?? "", offer_label_ar: p?.offer_label_ar ?? "",
    unit: p?.unit ?? "pcs", min_order_qty: String(p?.min_order_qty ?? 1), short_desc_en: p?.short_desc_en ?? "", short_desc_ar: p?.short_desc_ar ?? "", description_en: p?.description_en ?? "", description_ar: p?.description_ar ?? "",
    seo_title_en: p?.seo_title_en ?? "", seo_title_ar: p?.seo_title_ar ?? "", seo_desc_en: p?.seo_desc_en ?? "", seo_desc_ar: p?.seo_desc_ar ?? "",
    og_title_en: p?.og_title_en ?? "", og_title_ar: p?.og_title_ar ?? "", og_desc_en: p?.og_desc_en ?? "", og_desc_ar: p?.og_desc_ar ?? "", og_image_path: p?.og_image_path ?? "", seo_noindex: p?.seo_noindex ?? false,
  });
  const [pr, setPr] = React.useState({ quote: p?.is_quote_only ?? true, base: p?.base_price?.toString() ?? "", compare: p?.compare_at_price?.toString() ?? "", cost: p?.purchase_cost?.toString() ?? "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof g) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setG((x) => ({ ...x, [k]: e.target.value }));
  const chk = (k: "is_featured" | "is_new_arrival" | "is_special_offer") => (e: React.ChangeEvent<HTMLInputElement>) => setG((x) => ({ ...x, [k]: e.target.checked }));
  const n = (v: string) => (v.trim() === "" ? null : Number(v));

  async function saveGeneral() {
    setBusy(true);
    const r = await run(saveProductGeneral(p?.id ?? null, {
      ...g, name_ar: g.name_ar || null, slug: g.slug || null, sku: g.sku || null, barcode: g.barcode || null, category_id: g.category_id || null, brand_id: g.brand_id || null,
      offer_label_en: g.offer_label_en || null, offer_label_ar: g.offer_label_ar || null, min_order_qty: Number(g.min_order_qty) || 1, short_desc_en: g.short_desc_en || null, short_desc_ar: g.short_desc_ar || null,
      description_en: g.description_en || null, description_ar: g.description_ar || null, seo_title_en: g.seo_title_en || null, seo_title_ar: g.seo_title_ar || null, seo_desc_en: g.seo_desc_en || null, seo_desc_ar: g.seo_desc_ar || null,
      og_title_en: g.og_title_en || null, og_title_ar: g.og_title_ar || null, og_desc_en: g.og_desc_en || null, og_desc_ar: g.og_desc_ar || null, og_image_path: g.og_image_path || null, seo_noindex: g.seo_noindex,
    }), "Saved");
    setBusy(false);
    if (r) { if (!p) router.push(`/admin/products/${r.id}`); else router.refresh(); }
  }
  async function savePricing() {
    if (!p) return; setBusy(true);
    const r = await run(saveProductPricing(p.id, { is_quote_only: pr.quote, base_price: n(pr.base), compare_at_price: n(pr.compare), purchase_cost: n(pr.cost) }), "Pricing saved");
    setBusy(false); if (r !== undefined) router.refresh();
  }
  const margin = n(pr.base) != null && n(pr.cost) != null && Number(pr.base) > 0 ? ((Number(pr.base) - Number(pr.cost)) / Number(pr.base)) * 100 : null;

  const needsSave = !p;
  return (
    <div className="space-y-4">
      {p && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
          <Badge variant={p.status === "published" ? "success" : p.status === "draft" ? "warning" : "secondary"}>{p.status}</Badge>
          {p.is_quote_only && <Badge variant="secondary">Quote only</Badge>}
          <div className="ms-auto flex gap-2">
            {p.status === "published" && <Button variant="outline" size="sm" asChild><a href={`/en/product/${p.slug}`} target="_blank"><ExternalLink className="size-4" />View on website</a></Button>}
            {p.status !== "published" && <Button size="sm" disabled={busy} onClick={async () => { if (await run(setProductsStatus([p.id], "published"), "Published — now visible on the website")) router.refresh(); }}>Publish</Button>}
            {p.status === "published" && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { if (await run(setProductsStatus([p.id], "draft"), "Unpublished")) router.refresh(); }}>Unpublish</Button>}
          </div>
        </div>
      )}
      <Tabs defaultValue={p && props.initialTab ? props.initialTab : "general"}>
        <TabsList className="h-auto flex-wrap">
          {["general", "pricing", "variants", "attributes", "materials", "images", "documents", "certifications", "related", "seo"].map((t) => <TabsTrigger key={t} value={t} disabled={needsSave && t !== "general" && t !== "seo"} className="capitalize">{t}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="general"><Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English) *"><Input value={g.name_en} onChange={set("name_en")} /></Field>
            <Field label="Name (Arabic)"><Input dir="rtl" value={g.name_ar} onChange={set("name_ar")} /></Field>
            <Field label="SKU" hint="Leave empty until a real sellable SKU exists. Duplicates are rejected."><Input value={g.sku} onChange={set("sku")} className="font-mono" /></Field>
            <Field label="Barcode"><Input value={g.barcode} onChange={set("barcode")} className="font-mono" /></Field>
            <Field label="Category"><NativeSelect value={g.category_id} onChange={set("category_id")}><option value="">— none —</option>{props.categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "   ↳ " : ""}{c.name}</option>)}</NativeSelect></Field>
            <Field label="Brand"><NativeSelect value={g.brand_id} onChange={set("brand_id")}><option value="">— none —</option>{props.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect></Field>
            <Field label="Status"><NativeSelect value={g.status} onChange={set("status")}><option value="draft">Draft (hidden)</option><option value="published">Published (live)</option><option value="archived">Archived (hidden)</option></NativeSelect></Field>
            <Field label="URL slug" hint="Auto-generated from the name if empty. If you change it later, the old address redirects to the new one automatically (permanent redirect)."><Input value={g.slug} onChange={set("slug")} className="font-mono" dir="ltr" /></Field>
            <Field label="Unit"><Input value={g.unit} onChange={set("unit")} placeholder="pcs, m, kg, set…" /></Field>
            <Field label="Minimum order quantity"><Input type="number" min="0.01" step="any" value={g.min_order_qty} onChange={set("min_order_qty")} /></Field>
            <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={g.is_featured} onChange={chk("is_featured")} />Featured</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={g.is_new_arrival} onChange={chk("is_new_arrival")} />New arrival</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={g.is_special_offer} onChange={chk("is_special_offer")} />Special offer</label>
            </div>
            {g.is_special_offer && <><Field label="Offer label (English)"><Input value={g.offer_label_en} onChange={set("offer_label_en")} placeholder="e.g. Project price" /></Field><Field label="Offer label (Arabic)"><Input dir="rtl" value={g.offer_label_ar} onChange={set("offer_label_ar")} /></Field></>}
            <Field label="Short description (English)" className="sm:col-span-2"><Textarea rows={2} value={g.short_desc_en} onChange={set("short_desc_en")} /></Field>
            <Field label="Short description (Arabic)" className="sm:col-span-2"><Textarea dir="rtl" rows={2} value={g.short_desc_ar} onChange={set("short_desc_ar")} /></Field>
            <Field label="Full description (English)" className="sm:col-span-2"><Textarea rows={6} value={g.description_en} onChange={set("description_en")} /></Field>
            <Field label="Full description (Arabic)" className="sm:col-span-2"><Textarea dir="rtl" rows={6} value={g.description_ar} onChange={set("description_ar")} /></Field>
          </div>
          <div className="mt-5 flex gap-2"><Button disabled={busy} onClick={saveGeneral}>{p ? "Save changes" : "Create product"}</Button>{p && <Button variant="ghost" asChild><Link href="/admin/products">Back to list</Link></Button>}</div>
        </Panel></TabsContent>

        <TabsContent value="pricing"><Panel>
          <div className="grid max-w-xl gap-4">
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={pr.quote} onChange={(e) => setPr({ ...pr, quote: e.target.checked })} className="mt-0.5" /><span><strong>Quote only</strong> — customers request a quotation instead of buying online. Keep this on until a real price (and stock) exists.</span></label>
            <Field label="Selling price (SAR, ex-VAT)" hint="Used when the product has no variants, or as the default for variants without their own price."><Input type="number" min="0" step="0.01" value={pr.base} onChange={(e) => setPr({ ...pr, base: e.target.value })} /></Field>
            <Field label="Compare-at price (SAR, optional)" hint="Shown as the old price for special offers."><Input type="number" min="0" step="0.01" value={pr.compare} onChange={(e) => setPr({ ...pr, compare: e.target.value })} /></Field>
            <Field label="Purchase cost (SAR, private)" hint="Only visible to staff. Used for profit tracking."><Input type="number" min="0" step="0.01" value={pr.cost} onChange={(e) => setPr({ ...pr, cost: e.target.value })} /></Field>
            {margin != null && <p className="text-sm text-muted-foreground">Margin: <strong className={margin < 0 ? "text-destructive" : "text-foreground"}>{margin.toFixed(1)}%</strong> · profit per unit {formatSAR(Number(pr.base) - Number(pr.cost))}</p>}
            <div><Button disabled={busy} onClick={savePricing}>Save pricing</Button></div>
          </div>
        </Panel></TabsContent>

        {p && <>
          <TabsContent value="variants"><ProductVariants productId={p.id} rows={props.variants} /></TabsContent>
          <TabsContent value="attributes"><ProductAttributes productId={p.id} defs={props.attrDefs} values={props.attrValues} /></TabsContent>
          <TabsContent value="materials"><ProductMaterials productId={p.id} rows={props.materials ?? []} types={props.materialTypes ?? []} variants={props.variantMaterials ?? []} /></TabsContent>
          <TabsContent value="images"><ProductImages productId={p.id} rows={props.images} /></TabsContent>
          <TabsContent value="documents"><ProductDocs productId={p.id} rows={props.docs} /></TabsContent>
          <TabsContent value="certifications"><ProductCerts productId={p.id} certs={props.certOptions} initial={props.assignments} variants={props.variantOptions} isAdmin={props.isAdmin} /></TabsContent>
          <TabsContent value="related"><ProductRelations productId={p.id} related={props.related} alternatives={props.alternatives} /></TabsContent>
        </>}

        <TabsContent value="seo"><SeoTab g={g} set={set} setG={setG} p={p} variants={props.variants} images={props.images} brandName={props.brands.find((b) => b.id === g.brand_id)?.name ?? null} busy={busy} needsSave={needsSave} onSave={saveGeneral} /></TabsContent>
      </Tabs>
    </div>
  );
}
