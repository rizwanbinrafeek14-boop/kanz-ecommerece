"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, Panel } from "../ui";
import { createWebSource } from "@/lib/admin/web-catalogue-actions";
import { run } from "@/lib/admin/client";

/** Start a manufacturer-website import: start page, crawl scope and limits, and the reuse permission for images / documents. */
export function WebSourceForm({ brands }: { brands: { id: string; name: string }[] }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({ title: "", start_url: "", path_prefix: "", brand: "", new_brand: "", max_pages: 500, delay_s: 3, reuse_images: false, reuse_documents: false, permission_note: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const go = async () => {
    setBusy(true);
    const r = await run(createWebSource({ title: f.title.trim() || f.start_url, start_url: f.start_url, path_prefix: f.path_prefix, brand_id: f.brand || null, new_brand: f.brand ? null : f.new_brand.trim() || null,
      max_pages: Number(f.max_pages), delay_ms: Math.round(Number(f.delay_s) * 1000), reuse_images: f.reuse_images, reuse_documents: f.reuse_documents, permission_note: f.permission_note.trim() || null }), "Website source created");
    setBusy(false); if (r) router.push(`/admin/catalogue/${(r as { id: string }).id}`);
  };
  const needsNote = f.reuse_images || f.reuse_documents;
  return (
    <Panel title="Import from a manufacturer website">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Start page (product listing)" hint="e.g. https://www.manufacturer.com/products/index.html — pagination and product pages are discovered from here."><Input value={f.start_url} onChange={(e) => set("start_url", e.target.value)} placeholder="https://" inputMode="url" aria-label="Start page" /></Field>
        <Field label="Title"><Input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="e.g. GALA website catalogue" /></Field>
        <Field label="Manufacturer"><NativeSelect value={f.brand} onChange={(e) => set("brand", e.target.value)}><option value="">New manufacturer…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect></Field>
        {!f.brand && <Field label="Manufacturer of this website"><Input value={f.new_brand} onChange={(e) => set("new_brand", e.target.value)} maxLength={120} placeholder="e.g. GALA" /></Field>}
        <Field label="Only follow pages under this path" hint="Empty = the folder of the start page (e.g. /products/). Use / for the whole site."><Input value={f.path_prefix} onChange={(e) => set("path_prefix", e.target.value)} placeholder="/products/" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Maximum pages"><Input type="number" min={1} max={5000} value={f.max_pages} onChange={(e) => set("max_pages", Number(e.target.value))} /></Field>
          <Field label="Seconds between requests" hint="At least 2; the site's robots.txt Crawl-delay is used when larger."><Input type="number" min={2} max={60} step={1} value={f.delay_s} onChange={(e) => set("delay_s", Number(e.target.value))} /></Field>
        </div>
      </div>
      <fieldset className="mt-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Reuse of the manufacturer&apos;s images and documents</legend>
        <p className="text-xs text-muted-foreground">Leave these off unless the manufacturer (or your distribution agreement) allows you to copy them. When off, product data is still imported; images are kept as review links (the product shows a labelled placeholder until you upload a photo) and datasheets are linked to the manufacturer&apos;s own file.</p>
        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.reuse_images} onChange={(e) => set("reuse_images", e.target.checked)} />Copy product images into our storage</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.reuse_documents} onChange={(e) => set("reuse_documents", e.target.checked)} />Copy datasheets / drawings (PDF)</label>
        </div>
        {needsNote && <Field label="Where does the permission come from?" className="mt-3"><Textarea rows={2} value={f.permission_note} onChange={(e) => set("permission_note", e.target.value)} maxLength={1000} placeholder="e.g. Distributor agreement 2026, clause 7 — or e-mail from GALA marketing, 12 Oct 2026" aria-label="Permission note" /></Field>}
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">The import identifies itself, follows the site&apos;s robots.txt, waits between requests, stays on the manufacturer&apos;s site, never logs in and stops when the site refuses access. Nothing is published: products are created as drafts only after you review and approve them.</p>
      <Button className="mt-4" onClick={go} disabled={busy || !f.start_url || (needsNote && !f.permission_note.trim())}><Globe className="size-4" />{busy ? "Creating…" : "Create website import"}</Button>
    </Panel>
  );
}
