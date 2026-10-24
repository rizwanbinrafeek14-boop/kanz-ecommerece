"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Checkbox } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field, Panel } from "./ui";
import { deleteCertification, saveCertification } from "@/lib/admin/contact-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { publicUrl } from "@/lib/format";

export interface CertRow { id: string; name_en: string; name_ar: string | null; issuer: string | null; reference_number: string | null; valid_until: string | null; document_path: string | null; is_active: boolean; sort_order: number }
const blank = (): CertRow => ({ id: "", name_en: "", name_ar: "", issuer: "", reference_number: "", valid_until: null, document_path: null, is_active: true, sort_order: 0 });
const nn = (s: string | null) => (s == null || s.trim() === "" ? null : s.trim());

export function CertificationManager({ rows, isAdmin }: { rows: CertRow[]; isAdmin: boolean }) {
  const router = useRouter(); const [e, setE] = React.useState<CertRow | null>(null); const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const save = async () => {
    if (!e) return; setBusy(true);
    const ok = await run(saveCertification(e.id || null, { name_en: e.name_en, name_ar: nn(e.name_ar), issuer: nn(e.issuer), reference_number: nn(e.reference_number), valid_until: e.valid_until || null, document_path: e.document_path, is_active: e.is_active, sort_order: e.sort_order }), "Saved");
    setBusy(false); if (ok) { setE(null); router.refresh(); }
  };
  const upload = async (f?: File) => { if (!f) return; try { const p = await uploadToBucket("product-docs", f, "certifications"); setE((x) => x && { ...x, document_path: p }); } catch (er) { toast.error((er as Error).message); } };
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setE(blank())}><Plus className="size-4" />New certification</Button></div>
      <Panel>
        {!rows.length ? <p className="p-6 text-center text-sm text-muted-foreground">No certifications yet. Add only certifications the company really holds, then attach them to the products they cover. Nothing is shown on the website until you do.</p> : (
          <ul className="divide-y">{rows.map((c) => { const expired = c.valid_until && c.valid_until < today; return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-medium">{c.name_en}{!c.is_active && <Badge variant="secondary">Hidden</Badge>}{expired && <Badge variant="destructive">Expired — not shown</Badge>}</p>
                <p className="text-xs text-muted-foreground">{[c.issuer, c.reference_number && `Ref. ${c.reference_number}`, c.valid_until && `valid until ${c.valid_until}`].filter(Boolean).join(" · ") || "No details"}{c.document_path ? " · document attached" : ""}</p></div>
              <Button size="icon" variant="ghost" aria-label={`Edit ${c.name_en}`} onClick={() => setE({ ...c })}><Pencil className="size-4" /></Button>
              {isAdmin && <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${c.name_en}`} onClick={async () => { if (confirm(`Delete ${c.name_en}?`) && (await run(deleteCertification(c.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>}
            </li>); })}</ul>)}
      </Panel>
      {e && (
        <Dialog open onOpenChange={(o) => !o && setE(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{e.id ? "Edit certification" : "New certification"}</DialogTitle><DialogDescription>Shown as a badge on the products you attach it to. Expired certifications are hidden automatically.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <Field label="Name (English)"><Input value={e.name_en} onChange={(x) => setE({ ...e, name_en: x.target.value })} /></Field>
              <Field label="Name (Arabic)"><Input dir="rtl" value={e.name_ar ?? ""} onChange={(x) => setE({ ...e, name_ar: x.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Issued by"><Input value={e.issuer ?? ""} onChange={(x) => setE({ ...e, issuer: x.target.value })} /></Field>
                <Field label="Certificate number"><Input value={e.reference_number ?? ""} onChange={(x) => setE({ ...e, reference_number: x.target.value })} /></Field>
                <Field label="Valid until (optional)"><Input type="date" value={e.valid_until ?? ""} onChange={(x) => setE({ ...e, valid_until: x.target.value || null })} /></Field>
                <Field label="Display order"><Input type="number" min={0} value={e.sort_order} onChange={(x) => setE({ ...e, sort_order: Number(x.target.value) || 0 })} /></Field>
              </div>
              <Field label="Certificate document (PDF or image, public)" hint="Customers can open it from the product page. Do not upload anything confidential.">
                <div className="space-y-1"><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" onChange={(x) => upload(x.target.files?.[0])} />
                  {e.document_path && <p className="text-xs"><a className="underline" target="_blank" rel="noopener noreferrer" href={publicUrl("product-docs", e.document_path) ?? "#"}>View attached document</a> · <button type="button" className="underline" onClick={() => setE({ ...e, document_path: null })}>remove</button></p>}</div>
              </Field>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={e.is_active} onChange={(x) => setE({ ...e, is_active: x.target.checked })} />Show on the website</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setE(null)}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>)}
    </>
  );
}
