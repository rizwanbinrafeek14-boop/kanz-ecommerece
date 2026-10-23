"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X, Undo2, Rocket, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { setImportStatus, publishImportItems } from "@/lib/admin/import-actions";
import { run } from "@/lib/admin/client";
import { ProductImage } from "@/components/storefront/product-image";

export interface ReviewItem { id: string; name_en: string; name_ar: string | null; status: string; flags: string[]; image: string | null; source_page: number | null; category: string | null; published_product_id: string | null }
export const FLAG_LABEL: Record<string, string> = {
  foreign_branding: "Third-party branding", verify_specs: "Verify specs", low_res: "Low-res image", not_in_uploaded_pdf: "Not in uploaded PDF", ar_draft: "Arabic = draft",
};
const flagVariant = (f: string) => (f === "foreign_branding" ? "destructive" : f === "verify_specs" || f === "not_in_uploaded_pdf" ? "warning" : "secondary") as "destructive" | "warning" | "secondary";
const statusVariant = { pending: "warning", approved: "info", rejected: "secondary", published: "success" } as const;

export function BatchReview({ items, initialStatus, initialFlag }: { items: ReviewItem[]; initialStatus: string; initialFlag: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [flag, setFlag] = React.useState(initialFlag);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [ack, setAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const shown = items.filter((i) => (status === "all" || i.status === status) && (!flag || i.flags.includes(flag)));
  const counts = items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.status]: (m[i.status] ?? 0) + 1 }), {});
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel];
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false); setSel(new Set()); router.refresh(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {["all", "pending", "approved", "rejected", "published"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 capitalize ${status === s ? "border-ink bg-ink text-white" : "hover:bg-accent"}`}>{s}{s !== "all" && ` (${counts[s] ?? 0})`}{s === "all" && ` (${items.length})`}</button>
        ))}
        <select value={flag} onChange={(e) => setFlag(e.target.value)} className="ms-auto h-9 rounded-md border bg-background px-2" aria-label="Filter by flag">
          <option value="">All flags</option>{Object.entries(FLAG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <Checkbox checked={shown.length > 0 && shown.every((i) => sel.has(i.id))} onChange={(e) => setSel(e.target.checked ? new Set(shown.filter((i) => i.status !== "published").map((i) => i.id)) : new Set())} aria-label="Select all" />
        <span className="text-sm text-muted-foreground">{ids.length} selected</span>
        <label className="ms-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />I reviewed flagged issues</label>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => act(async () => {
            const d = await run(setImportStatus(ids, "approved", ack), (x) => `${x.changed} approved`);
            if (d?.blocked.length) toast.warning(`Not approved (third-party branding — open and confirm each): ${d.blocked.join(", ")}`, { duration: 12000 });
          })}><Check className="size-4" />Approve</Button>
          <Button size="sm" variant="outline" disabled={busy || !ids.length} onClick={() => act(() => run(setImportStatus(ids, "rejected"), (d) => `${d.changed} rejected`))}><X className="size-4" />Reject</Button>
          <Button size="sm" variant="ghost" disabled={busy || !ids.length} onClick={() => act(() => run(setImportStatus(ids, "pending")))}><Undo2 className="size-4" />Reset</Button>
          <Button size="sm" disabled={busy || !ids.length} onClick={() => act(async () => {
            const d = await run(publishImportItems(ids), (x) => `${x.published} draft product(s) created`);
            d?.errors.forEach((e) => toast.error(e, { duration: 10000 }));
          })}><Rocket className="size-4" />Create draft products</Button>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((i) => (
          <li key={i.id} className={`flex gap-3 rounded-xl border bg-card p-3 ${sel.has(i.id) ? "ring-2 ring-primary" : ""}`}>
            <div className="flex flex-col items-center gap-2 pt-1"><Checkbox disabled={i.status === "published"} checked={sel.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.name_en}`} /></div>
            <Link href={`/admin/import/item/${i.id}`} className="block size-24 shrink-0 overflow-hidden rounded-lg border">
              {i.image ? <img src={i.image} alt={i.name_en} className="size-full bg-white object-contain" /> : <ProductImage alt="" className="size-full" />}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><Link href={`/admin/import/item/${i.id}`} className="font-semibold leading-snug hover:text-primary">{i.name_en}</Link><Badge variant={statusVariant[i.status as keyof typeof statusVariant]}>{i.status}</Badge></div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{i.category ?? "No category"}{i.source_page ? ` · catalogue p.${i.source_page}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {i.flags.map((f) => <Badge key={f} variant={flagVariant(f)}>{f === "foreign_branding" && <AlertTriangle className="me-1 size-3" />}{FLAG_LABEL[f] ?? f}</Badge>)}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <Link href={`/admin/import/item/${i.id}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Pencil className="size-3" />Edit</Link>
                {i.published_product_id && <Link href={`/admin/products/${i.published_product_id}`} className="text-primary hover:underline">Open product →</Link>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">No items match.</p>}
    </div>
  );
}
