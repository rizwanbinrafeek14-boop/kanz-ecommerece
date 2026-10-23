"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Send, Save, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Panel } from "./ui";
import { addInternalNote, convertRfqToOrder, saveQuotation, setRfqStatus } from "@/lib/admin/sales-actions";
import { run } from "@/lib/admin/client";
import { formatDateTime, formatSAR, withVat } from "@/lib/format";

const defaultValidUntil = () => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
interface Item { id: string; line_no: number; description: string; specification: string | null; quantity: number; unit: string; quoted_unit_price: number | null; quoted_lead_time: string | null; sku: string | null; productSlug: string | null }
interface Ev { id: number; event: string; detail: string | null; at: string; by: string | null }
interface Note { id: string; note: string; at: string; by: string | null }

export function RfqWorkbench({ rfq, items, events, notes, vatRate }: { rfq: Record<string, any>; items: Item[]; events: Ev[]; notes: Note[]; vatRate: number }) {
  const router = useRouter();
  const editable = ["submitted", "under_review", "quoted"].includes(rfq.status);
  const [price, setPrice] = React.useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, i.quoted_unit_price?.toString() ?? ""])));
  const [lead, setLead] = React.useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, i.quoted_lead_time ?? ""])));
  const [t, setT] = React.useState({ valid: rfq.quote_valid_until ?? defaultValidUntil(), lead: rfq.lead_time ?? "", pay: rfq.payment_terms ?? "", del: rfq.delivery_terms ?? "", notes: rfq.quote_notes ?? "" });
  const [note, setNote] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const sub = items.reduce((n, i) => n + (price[i.id] ? Number(price[i.id]) * i.quantity : 0), 0); const tot = withVat(sub, vatRate);
  const lines = () => items.map((i) => ({ id: i.id, unit_price: price[i.id] === "" || price[i.id] == null ? null : Number(price[i.id]), lead_time: lead[i.id]?.trim() || null }));
  const save = async (markQuoted: boolean) => { setBusy(true); const r = await run(saveQuotation(rfq.id, { lines: lines(), valid_until: t.valid || null, lead_time: t.lead || null, payment_terms: t.pay || null, delivery_terms: t.del || null, notes: t.notes || null, markQuoted }), markQuoted ? "Quotation saved and marked as quoted" : "Draft prices saved"); setBusy(false); if (r !== undefined) router.refresh(); };
  const status = async (s: Parameters<typeof setRfqStatus>[1]) => { if (await run(setRfqStatus(rfq.id, s), `Marked ${s.replace("_", " ")}`)) router.refresh(); };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel title="Requested items & quoted prices">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">#</th><th className="p-2 text-start">Item</th><th className="p-2 text-end">Qty</th><th className="p-2 text-end">Unit price (SAR, ex-VAT)</th><th className="p-2 text-start">Lead time</th><th className="p-2 text-end">Amount</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id} className="border-t align-top"><td className="p-2">{i.line_no}</td>
                <td className="p-2"><p className="font-medium">{i.productSlug ? <Link className="hover:text-primary" href={`/en/product/${i.productSlug}`} target="_blank">{i.description}</Link> : i.description}</p>{i.specification && <p className="text-xs text-muted-foreground">{i.specification}</p>}{i.sku && <p className="font-mono text-xs text-muted-foreground">{i.sku}</p>}</td>
                <td className="whitespace-nowrap p-2 text-end tabular-nums">{i.quantity} {i.unit}</td>
                <td className="p-2"><Input type="number" min={0} step="0.01" disabled={!editable} value={price[i.id]} onChange={(e) => setPrice({ ...price, [i.id]: e.target.value })} className="ms-auto h-8 w-32 text-end" aria-label={`Unit price line ${i.line_no}`} /></td>
                <td className="p-2"><Input disabled={!editable} value={lead[i.id]} onChange={(e) => setLead({ ...lead, [i.id]: e.target.value })} className="h-8 w-32" placeholder="e.g. 2 weeks" aria-label={`Lead time line ${i.line_no}`} /></td>
                <td className="p-2 text-end tabular-nums">{price[i.id] ? formatSAR(Number(price[i.id]) * i.quantity) : "—"}</td></tr>))}</tbody>
          </table></div>
          <div className="ms-auto mt-4 w-full max-w-xs space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatSAR(tot.subtotal)}</span></div><div className="flex justify-between"><span>VAT ({vatRate}%)</span><span className="tabular-nums">{formatSAR(tot.vat)}</span></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatSAR(tot.total)}</span></div></div>
        </Panel>

        <Panel title="Quotation terms">
          <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
            <Field label="Valid until *"><Input type="date" value={t.valid} onChange={(e) => setT({ ...t, valid: e.target.value })} /></Field>
            <Field label="Overall delivery lead time"><Input value={t.lead} onChange={(e) => setT({ ...t, lead: e.target.value })} placeholder="e.g. 3–4 weeks from PO" /></Field>
            <Field label="Payment terms"><Input value={t.pay} onChange={(e) => setT({ ...t, pay: e.target.value })} placeholder="e.g. 50% advance, 50% on delivery" /></Field>
            <Field label="Delivery terms"><Input value={t.del} onChange={(e) => setT({ ...t, del: e.target.value })} placeholder="e.g. Ex-works Al-Khobar" /></Field>
            <Field label="Notes to customer (shown on the PDF)" className="sm:col-span-2"><Textarea rows={3} value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} /></Field>
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-2">
            {editable && <><Button variant="outline" disabled={busy} onClick={() => save(false)}><Save className="size-4" />Save draft prices</Button><Button disabled={busy} onClick={() => save(true)}><Send className="size-4" />Save & mark as quoted</Button></>}
            {rfq.quoted_at && <Button variant="outline" asChild><a href={`/api/rfq/${rfq.access_token}/pdf`} target="_blank"><FileDown className="size-4" />Download PDF quotation</a></Button>}
            {["quoted", "accepted"].includes(rfq.status) && <Button variant="dark" disabled={busy} onClick={async () => { if (!confirm("Create an order from this quotation?")) return; const d = await run(convertRfqToOrder(rfq.id, "delivery"), "Order created"); if (d) router.push(`/admin/orders/${d.orderId}`); }}><ShoppingBag className="size-4" />Convert to order</Button>}
            {rfq.converted_order_id && <Button variant="outline" asChild><Link href={`/admin/orders/${rfq.converted_order_id}`}>Open order</Link></Button>}
          </div>
          {rfq.quoted_at && <p className="mt-3 text-xs text-muted-foreground">Customer link: <Link className="text-primary underline" href={`/en/rfq/view/${rfq.access_token}`} target="_blank">view as customer</Link> — send it with the PDF. (Email sending is not built in; copy the link into your email or WhatsApp.)</p>}
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Customer">
          <p className="font-semibold">{rfq.company_name || rfq.contact_name}</p>{rfq.company_name && <p className="text-sm">{rfq.contact_name}</p>}
          <p className="mt-1 text-sm"><a className="text-primary" href={`mailto:${rfq.contact_email}`}>{rfq.contact_email}</a></p>{rfq.contact_phone && <p className="text-sm" dir="ltr"><a href={`https://wa.me/${rfq.contact_phone.replace(/\D/g, "")}`} target="_blank" className="text-primary">{rfq.contact_phone}</a></p>}
          {rfq.vat_number && <p className="mt-1 text-xs text-muted-foreground">VAT: {rfq.vat_number}</p>}{rfq.delivery_city && <p className="text-xs text-muted-foreground">City: {rfq.delivery_city}</p>}{rfq.required_by && <p className="text-xs text-muted-foreground">Required by: {rfq.required_by}</p>}
          {rfq.customer_notes && <p className="mt-3 whitespace-pre-line rounded-md bg-muted p-2 text-sm">{rfq.customer_notes}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{rfq.user_id ? "Registered customer" : "Guest request"}</p>
        </Panel>
        <Panel title="Status">
          <div className="flex flex-wrap gap-2">
            {rfq.status === "submitted" && <Button size="sm" variant="outline" onClick={() => status("under_review")}>Start review</Button>}
            {["submitted", "under_review", "quoted"].includes(rfq.status) && <Button size="sm" variant="outline" onClick={() => status("rejected")}>Decline</Button>}
            {["quoted"].includes(rfq.status) && <Button size="sm" variant="outline" onClick={() => status("accepted")}>Mark accepted</Button>}
            {!["converted", "cancelled"].includes(rfq.status) && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Cancel this RFQ?")) status("cancelled"); }}>Cancel</Button>}
          </div>
        </Panel>
        <Panel title="Internal notes (staff only)">
          <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" /><Button onClick={async () => { if (await run(addInternalNote("rfq", rfq.id, note), "Note added")) { setNote(""); router.refresh(); } }}>Add</Button></div>
          <ul className="mt-3 space-y-2 text-sm">{notes.map((n) => <li key={n.id} className="rounded-md bg-muted p-2"><p className="whitespace-pre-line">{n.note}</p><p className="mt-1 text-xs text-muted-foreground">{n.by ?? "—"} · {formatDateTime(n.at)}</p></li>)}</ul>
        </Panel>
        <Panel title="Quotation history">
          <ol className="space-y-2 border-s ps-4 text-sm">{events.map((e) => <li key={e.id}><span className="font-medium">{e.event.replace(/[:_]/g, " ")}</span>{e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}<p className="text-xs text-muted-foreground">{e.by ?? "customer/system"} · {formatDateTime(e.at)}</p></li>)}</ol>
        </Panel>
      </div>
    </div>
  );
}
