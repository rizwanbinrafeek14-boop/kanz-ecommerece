"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { Field, Panel } from "./ui";
import { setProductCertifications, type Assignment } from "@/lib/admin/cert-actions";
import { run, uploadCertificatePdf } from "@/lib/admin/client";
import { publicUrl } from "@/lib/format";

export interface CertOption { id: string; name: string; note: string | null }   // note = why it is not shown publicly right now (unpublished / expired), if so
export interface VariantOption { id: string; label: string }
const STATUS: Record<Assignment["status"], string> = { verified: "Verified", pending: "Pending verification", not_available: "Not available", not_applicable: "Not applicable" };

export function ProductCerts({ productId, certs, initial, variants, isAdmin }: { productId: string; certs: CertOption[]; initial: Assignment[]; variants: VariantOption[]; isAdmin: boolean }) {
  const router = useRouter(); const [rows, setRows] = React.useState<Assignment[]>(initial); const [q, setQ] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const byId = new Map(certs.map((c) => [c.id, c]));
  const chosen = new Set(rows.map((r) => r.certification_id));
  const matches = certs.filter((c) => !chosen.has(c.id) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const patch = (id: string, p: Partial<Assignment>) => setRows((r) => r.map((x) => (x.certification_id === id ? { ...x, ...p } : x)));
  const add = (id: string) => setRows((r) => [...r, { certification_id: id, status: "pending", reference_number: null, document_path: null, verification_url: null, scope_note: null, variant_ids: [] }]);
  const upload = async (id: string, f?: File) => { if (!f) return; try { patch(id, { document_path: await uploadCertificatePdf(f) }); toast.success("PDF uploaded — remember to save"); } catch (e) { toast.error((e as Error).message); } };
  const save = async () => { setBusy(true); const ok = await run(setProductCertifications(productId, rows.map((r) => ({ ...r, reference_number: r.reference_number?.trim() || null, scope_note: r.scope_note?.trim() || null, verification_url: r.verification_url?.trim() || null }))), "Certifications saved"); setBusy(false); if (ok) router.refresh(); };

  if (!isAdmin) return <Panel title="Certifications & Approvals"><p className="text-sm text-muted-foreground">Only administrators can assign certifications. Verified approvals currently on this product: {initial.filter((r) => r.status === "verified").length}.</p></Panel>;
  return (
    <Panel title="Certifications & Approvals" actions={<Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save approvals"}</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">Only assignments marked <strong>Verified</strong>, whose certification is published and not expired, appear on the product page. A company or manufacturer certificate is <strong>never</strong> applied automatically: add it here and set the status yourself.</p>
      {!certs.length ? <p className="text-sm text-muted-foreground">No certifications exist yet. Create them under <Link className="underline" href="/admin/certifications">Certifications</Link>.</p> : (<>
        <div className="mb-5 rounded-lg border p-3">
          <label className="relative block"><span className="sr-only">Search certifications</span><Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input className="ps-9" placeholder="Search certifications to add…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Available certifications">
            {matches.length ? matches.map((c) => <li key={c.id}><Button type="button" size="sm" variant="outline" onClick={() => add(c.id)}><Plus className="size-3.5" />{c.name}</Button></li>) : <li className="text-sm text-muted-foreground">{chosen.size === certs.length ? "All certifications are already added." : "No match."}</li>}
          </ul>
        </div>
        {!rows.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No certifications assigned. The product page will say that certification information is not available.</p>}
        <ul className="space-y-4">
          {rows.map((r) => { const c = byId.get(r.certification_id); return (
            <li key={r.certification_id} className="rounded-xl border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{c?.name ?? "Unknown certification"}{r.status === "verified" ? <Badge variant="success">Verified</Badge> : <Badge variant="secondary">{STATUS[r.status]}</Badge>}{c?.note && <Badge variant="destructive">{c.note}</Badge>}</p>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setRows((x) => x.filter((y) => y.certification_id !== r.certification_id))}><Trash2 className="size-4" />Remove</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assignment status"><NativeSelect value={r.status} onChange={(e) => patch(r.certification_id, { status: e.target.value as Assignment["status"] })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
                <Field label="Approval / reference number (this product)"><Input dir="ltr" value={r.reference_number ?? ""} maxLength={100} onChange={(e) => patch(r.certification_id, { reference_number: e.target.value })} /></Field>
                <Field label="Product-specific certificate PDF" hint="Optional. Overrides the certification’s own document for this product.">
                  <div className="space-y-1"><input type="file" accept="application/pdf,.pdf" aria-label={`Upload PDF for ${c?.name ?? "certification"}`} className="text-sm" onChange={(e) => { upload(r.certification_id, e.target.files?.[0]); e.target.value = ""; }} />
                    {r.document_path && <p className="text-xs"><a className="underline" target="_blank" rel="noopener noreferrer" href={publicUrl("product-docs", r.document_path) ?? "#"}>View PDF</a> · <button type="button" className="underline" onClick={() => patch(r.certification_id, { document_path: null })}>remove</button></p>}</div></Field>
                <Field label="…or verification URL" hint="https:// only"><Input type="url" dir="ltr" value={r.verification_url ?? ""} onChange={(e) => patch(r.certification_id, { verification_url: e.target.value })} placeholder="https://" /></Field>
                <Field label="Scope note (shown to customers)" hint="e.g. “Sizes 2″–8″ only”. Leave empty if it applies to the whole product." className="sm:col-span-2"><Input value={r.scope_note ?? ""} maxLength={300} onChange={(e) => patch(r.certification_id, { scope_note: e.target.value })} /></Field>
              </div>
              {variants.length > 0 && (
                <fieldset className="mt-4"><legend className="text-sm font-medium">Applicable variants / sizes</legend>
                  <p className="mb-2 text-xs text-muted-foreground">{r.variant_ids.length ? "Badge appears only when one of the ticked variants is selected." : "None ticked = applies to every variant."}</p>
                  <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {variants.map((v) => <label key={v.id} className="flex items-center gap-2 text-sm"><Checkbox checked={r.variant_ids.includes(v.id)} onChange={(e) => patch(r.certification_id, { variant_ids: e.target.checked ? [...r.variant_ids, v.id] : r.variant_ids.filter((x) => x !== v.id) })} />{v.label}</label>)}
                  </div>
                </fieldset>)}
            </li>); })}
        </ul></>)}
    </Panel>
  );
}
