"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Field, Panel } from "./ui";
import { SeoPreview } from "./seo-preview";
import { defaultProductDescription, defaultProductTitle } from "@/lib/seo-defaults";
import type { VariantRow } from "./product-variants";
import type { ImageRow } from "./product-media";
import { publicUrl } from "@/lib/format";

export function SeoTab({ g, set, setG, p, variants, images, brandName, busy, needsSave, onSave }: {
  g: any; set: (k: any) => (e: React.ChangeEvent<any>) => void; setG: React.Dispatch<React.SetStateAction<any>>; p: { slug: string } | null;
  variants: VariantRow[]; images: ImageRow[]; brandName: string | null; busy: boolean; needsSave: boolean; onSave: () => void;
}) {
  const sizes = variants.map((v) => v.size); const grades = variants.map((v) => v.grade);
  const mk = (lang: "en" | "ar") => ({ name: (lang === "ar" ? g.name_ar || g.name_en : g.name_en) as string, sku: g.sku || variants[0]?.sku, shortDesc: lang === "ar" ? g.short_desc_ar : g.short_desc_en, brand: brandName, sizes, grades });
  const dflt = (lang: "en" | "ar") => ({ title: defaultProductTitle(mk(lang), lang), description: defaultProductDescription(mk(lang), lang) });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kanzcorner.com";
  const block = (lang: "en" | "ar") => {
    const d = dflt(lang); const t = (lang === "en" ? g.seo_title_en : g.seo_title_ar) as string; const ds = (lang === "en" ? g.seo_desc_en : g.seo_desc_ar) as string;
    return <SeoPreview rtl={lang === "ar"} url={`${site}/${lang}/product/${p?.slug ?? "…"}`} title={t || d.title} description={ds || d.description} usingDefault={{ title: !t, description: !ds }} />;
  };
  return (
    <Panel>
      <p className="mb-4 text-sm text-muted-foreground">Leave a box empty and a title and description are generated from this product’s real data (name, SKU, brand, sizes, grades). Type your own text to override. Google may still rewrite what it shows.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SEO title (English)" hint={`Aim for about 60 characters. Default: “${dflt("en").title}”`}><Input value={g.seo_title_en} onChange={set("seo_title_en")} maxLength={120} /></Field>
        <Field label="SEO title (Arabic)" hint="Arabic page only: a natural Arabic title, not a translation of the English one."><Input dir="rtl" value={g.seo_title_ar} onChange={set("seo_title_ar")} maxLength={120} /></Field>
        <Field label="Meta description (English)" hint="About 150–160 characters."><Textarea rows={3} value={g.seo_desc_en} onChange={set("seo_desc_en")} maxLength={300} placeholder={dflt("en").description} /></Field>
        <Field label="Meta description (Arabic)"><Textarea dir="rtl" rows={3} value={g.seo_desc_ar} onChange={set("seo_desc_ar")} maxLength={300} placeholder={dflt("ar").description} /></Field>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{block("en")}{block("ar")}</div>
      <h3 className="mb-3 mt-8 font-semibold">Social sharing (WhatsApp, Facebook, LinkedIn, X)</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sharing title (English)" hint="Empty = same as the SEO title."><Input value={g.og_title_en} onChange={set("og_title_en")} maxLength={120} /></Field>
        <Field label="Sharing title (Arabic)"><Input dir="rtl" value={g.og_title_ar} onChange={set("og_title_ar")} maxLength={120} /></Field>
        <Field label="Sharing description (English)"><Textarea rows={2} value={g.og_desc_en} onChange={set("og_desc_en")} maxLength={300} /></Field>
        <Field label="Sharing description (Arabic)"><Textarea dir="rtl" rows={2} value={g.og_desc_ar} onChange={set("og_desc_ar")} maxLength={300} /></Field>
        <Field label="Sharing image" hint="Choose one of this product’s uploaded images. Empty = the main image.">
          <div className="flex items-center gap-3"><NativeSelect value={g.og_image_path} onChange={set("og_image_path")}><option value="">Main image (default)</option>{images.map((im, n) => <option key={im.id} value={im.storage_path}>Image {n + 1}{im.is_primary ? " (main)" : ""}</option>)}</NativeSelect>
            {(g.og_image_path || images[0]) && <img src={publicUrl("product-images", g.og_image_path || images.find((i) => i.is_primary)?.storage_path || images[0]?.storage_path)!} alt="" className="size-12 rounded border bg-white object-contain" />}</div></Field>
      </div>
      <h3 className="mb-3 mt-8 font-semibold">Search engine visibility</h3>
      <label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={g.seo_noindex} onChange={(e) => setG((x: any) => ({ ...x, seo_noindex: e.target.checked }))} />
        <span><strong>Hide this product from search engines (noindex)</strong><br /><span className="text-muted-foreground">The page still works for visitors with the link. Use for pages you do not want in Google. Canonical addresses are managed automatically and cannot be overridden here, to prevent mistakes. Arabic pages without an Arabic product name are kept out of search automatically.</span></span></label>
      <div className="mt-5"><Button disabled={busy || needsSave} onClick={onSave}>Save SEO</Button>{needsSave && <span className="ms-3 text-sm text-muted-foreground">Create the product first.</span>}</div>
    </Panel>
  );
}
