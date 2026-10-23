"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, ClipboardPaste, CheckCircle2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { submitRfqAction } from "@/app/[lang]/actions";
import { getSessionId } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

interface Line { product_id?: string; variant_id?: string; description: string; specification: string; quantity: string; unit: string }
const blank = (): Line => ({ description: "", specification: "", quantity: "1", unit: "pcs" });

export function RfqForm({ lang, dict, defaults }: { lang: Locale; dict: Dictionary; defaults: { name: string; email: string; phone: string; company: string; vat_number: string } }) {
  const { quote, clear } = useCart();
  // Lines start from the saved quotation list; once the user edits, their edits take over.
  const seed = React.useMemo<Line[]>(() => (quote.length
    ? quote.map((q) => ({ product_id: q.productId, variant_id: q.variantId, description: q.name, specification: q.spec ?? "", quantity: String(q.qty), unit: q.unit }))
    : [blank()]), [quote]);
  const [edited, setEdited] = React.useState<Line[] | null>(null);
  const lines = edited ?? seed;
  const setLines = (fn: (ls: Line[]) => Line[]) => setEdited(fn(lines));
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ number: string; token: string } | null>(null);

  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  function importPaste() {
    const parsed = paste.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((row): Line => {
      const c = row.split(/\t|,|;/).map((x) => x.trim());
      const qty = [...c].reverse().find((x) => /^\d+(\.\d+)?$/.test(x));
      const rest = c.filter((x) => x !== qty);
      return { description: rest[0] ?? "", specification: rest.slice(1).join(" "), quantity: qty ?? "1", unit: "pcs" };
    }).filter((l) => l.description);
    if (parsed.length) setLines((ls) => [...ls.filter((l) => l.description), ...parsed]);
    setPaste("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const items = lines.filter((l) => l.description.trim()).map((l) => ({
      product_id: l.product_id || "", variant_id: l.variant_id || "", description: l.description, specification: l.specification || undefined, quantity: Number(l.quantity), unit: l.unit || "pcs",
    }));
    if (!items.length) { setError(dict.rfq.needItem); return; }
    if (items.some((i) => !(i.quantity > 0))) { setError(dict.common.error); return; }
    const fd = new FormData(e.currentTarget); const g = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
    if (fd.get("website")) { setDone({ number: "RFQ", token: "" }); return; }   // honeypot: pretend success to bots
    setBusy(true);
    const res = await submitRfqAction({
      contact: { name: g("name") ?? "", email: g("email") ?? "", phone: g("phone"), company: g("company"), vat_number: g("vat_number"), city: g("city"), required_by: g("required_by"), notes: g("notes"), session_id: getSessionId() },
      items,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    clear("quote"); setDone(res.data);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-success" />
        <h2 className="text-xl font-bold">{dict.rfq.success}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{dict.rfq.ref}</p>
        <p className="font-mono text-2xl font-bold" dir="ltr">{done.number}</p>
        <p className="mt-3 text-sm text-muted-foreground">{dict.rfq.successText}</p>
        <Button asChild className="mt-5"><Link href={`/${lang}/rfq/view/${done.token}`}>{dict.rfq.viewQuote}</Link></Button>
      </div>
    );
  }

  const f = (id: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={id}>{label}{props.required && " *"}</Label><Input id={id} name={id} {...props} /></div>
  );
  return (
    <form onSubmit={submit} className="space-y-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 opacity-0" />
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">{dict.rfq.contact}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {f("name", dict.rfq.name, { required: true, defaultValue: defaults.name })}
          {f("email", dict.rfq.email, { required: true, type: "email", defaultValue: defaults.email })}
          {f("phone", dict.rfq.phone, { defaultValue: defaults.phone, type: "tel" })}
          {f("company", dict.rfq.company, { defaultValue: defaults.company })}
          {f("vat_number", dict.rfq.vatNumber, { defaultValue: defaults.vat_number })}
          {f("city", dict.rfq.city)}
          {f("required_by", dict.rfq.requiredBy, { type: "date" })}
        </div>
        <div className="mt-4 space-y-1.5"><Label htmlFor="notes">{dict.rfq.notes}</Label><Textarea id="notes" name="notes" /></div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{dict.rfq.items} ({lines.filter((l) => l.description).length})</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="size-4" />{dict.rfq.addLine}</Button>
        </div>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[2fr_2fr_90px_80px_auto] sm:border-0 sm:p-0 sm:bg-transparent">
              <Input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder={dict.rfq.description} aria-label={dict.rfq.description} />
              <Input value={l.specification} onChange={(e) => upd(i, { specification: e.target.value })} placeholder={dict.rfq.specification} aria-label={dict.rfq.specification} />
              <Input type="number" min="0.01" step="any" value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} aria-label={dict.common.quantity} />
              <Input value={l.unit} onChange={(e) => upd(i, { unit: e.target.value })} aria-label={dict.common.unit} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, n) => n !== i) : [blank()]))} aria-label={dict.common.remove}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
        <details className="mt-5 rounded-lg border bg-muted/30 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><ClipboardPaste className="size-4" />{dict.rfq.bulkPaste}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{dict.rfq.bulkHint}</p>
          <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="mt-2 font-mono text-xs" rows={5} placeholder={'Carbon steel pipe ERW\t6" SCH40 API 5L Gr.B\t120'} />
          <Button type="button" size="sm" className="mt-2" onClick={importPaste} disabled={!paste.trim()}>{dict.rfq.import}</Button>
        </details>
      </section>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button size="lg" disabled={busy}>{busy ? dict.common.loading : dict.rfq.submit}</Button>
    </form>
  );
}
