"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field, Panel } from "./ui";
import { deleteCertification, reorderCertifications, saveCertification, saveQualityText, setCertificationPublished } from "@/lib/admin/cert-actions";
import { run, uploadCertificatePdf } from "@/lib/admin/client";
import { publicUrl } from "@/lib/format";

export interface CertRow {
  id: string; name_en: string; name_ar: string | null; description_en: string | null; description_ar: string | null; issuer: string | null; reference_number: string | null; holder: string | null;
  scope: "company" | "manufacturer" | "product"; issued_at: string | null; valid_until: string | null; document_path: string | null; verification_url: string | null; logo_path: string | null;
  show_on_quality: boolean; is_active: boolean; sort_order: number; assigned: number;
}
const SCOPES = { company: "Company", manufacturer: "Manufacturer", product: "Specific product / model" } as const;
const blank = (): CertRow => ({ id: "", name_en: "", name_ar: "", description_en: "", description_ar: "", issuer: "", reference_number: "", holder: "", scope: "company", issued_at: null, valid_until: null, document_path: null, verification_url: "", logo_path: null, show_on_quality: true, is_active: false, sort_order: 0, assigned: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const LOGO_MAX = 512 * 1024;

function useObjectUrl(f: File | null) {
  const url = React.useMemo(() => (f ? URL.createObjectURL(f) : null), [f]);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function status(c: CertRow): { label: string; v: "success" | "secondary" | "destructive" | "info" } {
  if (!c.is_active) return { label: "Unpublished", v: "secondary" };
  if (c.valid_until && c.valid_until < today()) return { label: "Expired — hidden", v: "destructive" };
  if (c.issued_at && c.issued_at > today()) return { label: "Not valid yet — hidden", v: "info" };
  return { label: "Published", v: "success" };
}

function CertDialog({ initial, onClose }: { initial: CertRow; onClose: () => void }) {
  const router = useRouter(); const [c, setC] = React.useState(initial); const [logo, setLogo] = React.useState<File | null>(null); const [rmLogo, setRmLogo] = React.useState(false); const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const preview = useObjectUrl(logo);
  const logoUrl = preview ?? (rmLogo ? null : publicUrl("site-icons", c.logo_path));
  const t = (k: keyof CertRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setC((x) => ({ ...x, [k]: e.target.value }));
  const nn = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const save = async () => {
    setErr("");
    if (c.is_active && !c.name_en.trim()) { setErr("Enter the certification name."); return; }
    setBusy(true);
    const fd = new FormData();
    fd.set("data", JSON.stringify({ id: c.id || null, name_en: c.name_en, name_ar: nn(c.name_ar), description_en: nn(c.description_en), description_ar: nn(c.description_ar), issuer: nn(c.issuer), reference_number: nn(c.reference_number), holder: nn(c.holder), scope: c.scope, issued_at: c.issued_at || null, valid_until: c.valid_until || null, document_path: c.document_path, verification_url: nn(c.verification_url), show_on_quality: c.show_on_quality, is_active: c.is_active, removeLogo: rmLogo }));
    if (logo) fd.set("logo", logo);
    const ok = await run(saveCertification(fd), "Certification saved"); setBusy(false);
    if (ok) { onClose(); router.refresh(); }
  };
  const pickLogo = (f?: File) => {
    if (!f) return; if (f.size > LOGO_MAX) { toast.error("Logo is larger than 512 KB."); return; }
    if (!/^image\/(png|webp|svg\+xml)$/.test(f.type) && !/\.svg$/i.test(f.name)) { toast.error("Use a PNG, WebP or SVG logo."); return; }
    setLogo(f); setRmLogo(false);
  };
  const pickPdf = async (f?: File) => { if (!f) return; try { const p = await uploadCertificatePdf(f); setC((x) => ({ ...x, document_path: p })); toast.success("PDF uploaded"); } catch (e) { toast.error((e as Error).message); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{c.id ? "Edit certification" : "New certification"}</DialogTitle><DialogDescription>Enter only certifications that really exist, and upload the official logo supplied by the issuer. Nothing is shown publicly until you publish it.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certification name (English)"><Input value={c.name_en} onChange={t("name_en")} maxLength={150} placeholder="e.g. UL Listed" /></Field>
            <Field label="Certification name (Arabic)"><Input dir="rtl" value={c.name_ar ?? ""} onChange={t("name_ar")} maxLength={150} /></Field>
            <Field label="Description (English)"><Textarea value={c.description_en ?? ""} onChange={t("description_en")} maxLength={1000} /></Field>
            <Field label="Description (Arabic)"><Textarea dir="rtl" value={c.description_ar ?? ""} onChange={t("description_ar")} maxLength={1000} /></Field>
            <Field label="Issuing organization"><Input value={c.issuer ?? ""} onChange={t("issuer")} maxLength={150} /></Field>
            <Field label="Certificate number"><Input dir="ltr" value={c.reference_number ?? ""} onChange={t("reference_number")} maxLength={100} /></Field>
            <Field label="Certificate holder / manufacturer"><Input value={c.holder ?? ""} onChange={t("holder")} maxLength={150} /></Field>
            <Field label="Scope" hint="Who or what the certificate covers. Assigning it to a product is a separate, deliberate step."><NativeSelect value={c.scope} onChange={t("scope")}>{Object.entries(SCOPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
            <Field label="Issue date (optional)"><Input type="date" value={c.issued_at ?? ""} onChange={(e) => setC({ ...c, issued_at: e.target.value || null })} /></Field>
            <Field label="Expiry date (optional)" hint="After this date the certification disappears from the website automatically."><Input type="date" value={c.valid_until ?? ""} onChange={(e) => setC({ ...c, valid_until: e.target.value || null })} /></Field>
          </div>
          <div className="space-y-2"><p className="text-sm font-medium">Official logo</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-20 w-32 items-center justify-center rounded-lg border bg-white p-2">{logoUrl ? <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}</span>
              <input type="file" accept="image/png,image/webp,image/svg+xml,.svg" aria-label="Upload the official logo" className="text-sm" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
              {(logo || c.logo_path) && !rmLogo && <Button type="button" variant="outline" size="sm" onClick={() => { setLogo(null); setRmLogo(true); }}>Remove logo</Button>}
            </div>
            <p className="text-xs text-muted-foreground">PNG, WebP or SVG, up to 512 KB, at least 16×16 px. Upload the logo exactly as supplied by the issuer; do not redraw it.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certificate PDF" hint="PDF only, up to 10 MB. It is public once the certification is published.">
              <div className="space-y-1"><input type="file" accept="application/pdf,.pdf" aria-label="Upload certificate PDF" className="text-sm" onChange={(e) => { pickPdf(e.target.files?.[0]); e.target.value = ""; }} />
                {c.document_path && <p className="text-xs"><a className="underline" target="_blank" rel="noopener noreferrer" href={publicUrl("product-docs", c.document_path) ?? "#"}>View uploaded PDF</a> · <button type="button" className="underline" onClick={() => setC({ ...c, document_path: null })}>remove</button></p>}</div>
            </Field>
            <Field label="…or external verification URL" hint="Must start with https://"><Input type="url" dir="ltr" value={c.verification_url ?? ""} onChange={t("verification_url")} placeholder="https://" /></Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={c.show_on_quality} onChange={(e) => setC({ ...c, show_on_quality: e.target.checked })} />Show on the Quality page</label>
            <label className="flex items-center gap-2"><Checkbox checked={c.is_active} onChange={(e) => setC({ ...c, is_active: e.target.checked })} />Published</label>
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save certification"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface QualityText { intro_en: string; intro_ar: string; banner_en: string; banner_ar: string }
function QualityTextPanel({ initial }: { initial: QualityText }) {
  const router = useRouter(); const [v, setV] = React.useState(initial); const [busy, setBusy] = React.useState(false);
  const set = (k: keyof QualityText) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Panel title="Quality page text" actions={<Button size="sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await run(saveQualityText(v), "Quality page text saved"); setBusy(false); if (ok) router.refresh(); }}>{busy ? "Saving…" : "Save text"}</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">Leave a box empty to use the standard wording. Separate paragraphs with a blank line. Do not claim that KANZ CORNER manufactures or tests products unless that is true.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="“Quality Assurance” introduction (English)"><Textarea rows={5} value={v.intro_en} onChange={set("intro_en")} maxLength={3000} /></Field>
        <Field label="“Quality Assurance” introduction (Arabic)"><Textarea rows={5} dir="rtl" value={v.intro_ar} onChange={set("intro_ar")} maxLength={3000} /></Field>
        <Field label="Banner heading (English)"><Input value={v.banner_en} onChange={set("banner_en")} maxLength={150} /></Field>
        <Field label="Banner heading (Arabic)"><Input dir="rtl" value={v.banner_ar} onChange={set("banner_ar")} maxLength={150} /></Field>
      </div>
    </Panel>
  );
}

export function CertificationManager({ rows, text }: { rows: CertRow[]; text: QualityText }) {
  const router = useRouter(); const [edit, setEdit] = React.useState<CertRow | null>(null);
  const move = async (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= rows.length) return; const a = [...rows]; [a[i], a[j]] = [a[j], a[i]]; if (await run(reorderCertifications(a.map((x, n) => ({ id: x.id, sort_order: (n + 1) * 10 }))))) router.refresh(); };
  return (
    <div className="space-y-6">
      <Panel title="Certification library" actions={<Button onClick={() => setEdit(blank())}><Plus className="size-4" />New certification</Button>}>
        {!rows.length ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No certifications yet. Add only certificates the company or its manufacturers really hold. Until you publish one, the Quality page and product pages show no certification claims.</p> : (
          <ul className="divide-y">{rows.map((c, i) => { const st = status(c); const logo = publicUrl("site-icons", c.logo_path); return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border bg-white p-1">{logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">No logo</span>}</span>
              <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-medium">{c.name_en}<Badge variant={st.v}>{st.label}</Badge>{!c.show_on_quality && <Badge variant="secondary">Not on Quality page</Badge>}</p>
                <p className="text-xs text-muted-foreground">{[SCOPES[c.scope], c.issuer, c.reference_number && `No. ${c.reference_number}`, c.valid_until && `expires ${c.valid_until}`].filter(Boolean).join(" · ")} · assigned to {c.assigned} product{c.assigned === 1 ? "" : "s"}</p>
                {(c.document_path || c.verification_url) && <a className="inline-flex items-center gap-1 text-xs underline" target="_blank" rel="noopener noreferrer" href={c.document_path ? publicUrl("product-docs", c.document_path)! : c.verification_url!}>Certificate link<ExternalLink className="size-3" aria-hidden="true" /></a>}</div>
              <div className="flex">
                <Button size="icon" variant="ghost" aria-label={`Move ${c.name_en} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Move ${c.name_en} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={c.is_active ? `Unpublish ${c.name_en}` : `Publish ${c.name_en}`} onClick={async () => { if (await run(setCertificationPublished(c.id, !c.is_active), c.is_active ? "Unpublished" : "Published")) router.refresh(); }}>{c.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                <Button size="icon" variant="ghost" aria-label={`Edit ${c.name_en}`} onClick={() => setEdit({ ...c })}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${c.name_en}`} onClick={async () => {
                  const warn = c.assigned ? `“${c.name_en}” is assigned to ${c.assigned} product(s). Deleting it removes it from all of them and cannot be undone.\n\nTip: use Unpublish to hide it without losing the assignments.\n\nDelete anyway?` : `Delete “${c.name_en}”?`;
                  if (confirm(warn)) { const r = await run(deleteCertification(c.id), (d) => `Deleted${d.removedFromProducts ? ` (removed from ${d.removedFromProducts} product${d.removedFromProducts === 1 ? "" : "s"})` : ""}`); if (r) router.refresh(); } }}><Trash2 className="size-4" /></Button>
              </div>
            </li>); })}</ul>)}
      </Panel>
      <QualityTextPanel initial={text} />
      {edit && <CertDialog key={edit.id || "new"} initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
