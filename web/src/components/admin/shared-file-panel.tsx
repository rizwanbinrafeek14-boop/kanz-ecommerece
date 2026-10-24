"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileCheck2, Upload } from "lucide-react";
import { setBatchSharedFile } from "@/lib/admin/import-actions";
import { run, uploadToBucket } from "@/lib/admin/client";

/** One private PDF (e.g. the supplier's mill-test-certificate bundle) attached to every product created from this batch. */
export function SharedFilePanel({ batchId, current }: { batchId: string; current: string | null }) {
  const router = useRouter(); const [busy, setBusy] = React.useState(false);
  async function pick(f?: File) {
    if (!f) return;
    if (f.type !== "application/pdf") { toast.error("Please choose a PDF file."); return; }
    setBusy(true);
    try { const path = await uploadToBucket("product-mtc", f, `batch-${batchId}`); if (await run(setBatchSharedFile(batchId, path), "Certificate file saved")) router.refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${current ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
      <FileCheck2 className={`size-6 ${current ? "text-green-700" : "text-amber-700"}`} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{current ? "Supplier certificate PDF is uploaded" : "Upload the supplier certificate PDF first"}</p>
        <p className="text-muted-foreground">It is stored <strong>privately</strong> (never shown to customers) and attached as an MTC to every product created from this batch, with the relevant page numbers in its title. Upload it before pressing “Create draft products”.</p>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"><Upload className="size-4" />{busy ? "Uploading…" : current ? "Replace file" : "Choose PDF"}<input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} /></label>
    </div>
  );
}
