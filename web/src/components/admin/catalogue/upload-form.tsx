"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field, Panel } from "../ui";
import { createClient } from "@/lib/supabase/browser";
import { createSource } from "@/lib/admin/catalogue-actions";
import { run } from "@/lib/admin/client";
import { openPdf } from "./pdf";

/** Upload a manufacturer PDF to the private catalogue-sources bucket and create the extraction job. */
export function UploadForm({ brands }: { brands: { id: string; name: string }[] }) {
  const router = useRouter(); const [file, setFile] = React.useState<File | null>(null); const [title, setTitle] = React.useState("");
  const [brand, setBrand] = React.useState(""); const [newBrand, setNewBrand] = React.useState(""); const [busy, setBusy] = React.useState("");
  const go = async () => {
    if (!file) return toast.error("Choose a PDF.");
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return toast.error("Only PDF catalogues can be uploaded.");
    if (file.size > 50 * 1024 * 1024) return toast.error("The PDF is larger than 50 MB.");
    if (!brand && !newBrand.trim()) return toast.error("Choose the manufacturer or type a new one.");
    try {
      setBusy("Reading the PDF…");
      const buf = await file.arrayBuffer(); const doc = await openPdf(buf.slice(0)); const pages = doc.numPages; await doc.cleanup();
      setBusy("Uploading (private)…");
      const path = `sources/${crypto.randomUUID()}.pdf`;
      const { error } = await createClient().storage.from("catalogue-sources").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error(error.message);
      setBusy("Creating the job…");
      const r = await run(createSource({ title: title.trim() || file.name.replace(/\.pdf$/i, ""), brand_id: brand || null, new_brand: brand ? null : newBrand.trim(), file_path: path, file_size: file.size, page_count: pages }), `Uploaded: ${pages} pages`);
      if (r) router.push(`/admin/catalogue/${(r as { id: string }).id}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };
  return (
    <Panel title="Upload a manufacturer catalogue">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <Field label="PDF catalogue"><input type="file" accept="application/pdf,.pdf" aria-label="PDF catalogue" className="block w-full text-sm" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "")); }} /></Field>
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
        <Field label="Manufacturer" hint="Or type a new manufacturer below.">
          <NativeSelect value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">New manufacturer…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect>
        </Field>
        <Button onClick={go} disabled={!!busy}><Upload className="size-4" />{busy || "Upload"}</Button>
      </div>
      {!brand && <div className="mt-3 max-w-sm"><Field label="New manufacturer name"><Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} maxLength={120} placeholder="e.g. Delcorte" /></Field></div>}
      <p className="mt-3 text-xs text-muted-foreground">The PDF is stored privately and never shown on the website. Pages are rendered in your browser in the next step. Up to 50 MB.</p>
    </Panel>
  );
}
