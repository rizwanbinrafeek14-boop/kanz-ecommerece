"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileDown, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Panel } from "./ui";
import { StatusBadge } from "./status-badge";
import { addInternalNote, issueInvoice, recordPayment, saveShipment, setOrderStatus } from "@/lib/admin/sales-actions";
import { run } from "@/lib/admin/client";
import { formatDateTime, formatSAR } from "@/lib/format";

const STATUSES = ["pending", "confirmed", "processing", "ready_for_pickup", "shipped", "delivered", "completed", "cancelled", "refunded"];
const METHODS = ["bank_transfer", "cod", "card", "mada", "apple_pay", "stc_pay", "credit_account", "other"];

export function OrderWorkbench({ order: o, costs, notes }: { order: any; costs: Record<string, number>; notes: { id: string; note: string; at: string; by: string | null }[] }) {
  const router = useRouter(); const [status, setStatus] = React.useState(o.status); const [snote, setSnote] = React.useState(""); const [note, setNote] = React.useState("");
  const [payOpen, setPayOpen] = React.useState(false); const [pay, setPay] = React.useState({ method: "bank_transfer", amount: "", ref: "", note: "" });
  const [shipOpen, setShipOpen] = React.useState<any | null>(null);
  const items = o.order_items as any[]; const invoice = (o.invoices as any[])?.[0];
  const cost = items.reduce((n, i) => n + (costs[i.id] ?? 0) * Number(i.quantity), 0); const hasCost = items.some((i) => costs[i.id] != null);
  const profit = Number(o.subtotal) - cost; const due = Number(o.grand_total) - Number(o.amount_paid);
  const addr = o.shipping_address as Record<string, string> | null;
  const refresh = () => router.refresh();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel title="Items">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs uppercase text-muted-foreground"><tr><th className="p-2 text-start">Item</th><th className="p-2 text-end">Qty</th><th className="p-2 text-end">Unit</th><th className="p-2 text-end">Total</th>{hasCost && <th className="p-2 text-end">Cost</th>}</tr></thead>
            <tbody>{items.map((i) => (<tr key={i.id} className="border-t"><td className="p-2"><p className="font-medium">{i.name_en}</p><p className="font-mono text-xs text-muted-foreground">{[i.sku, i.spec_summary].filter(Boolean).join(" · ")}</p></td><td className="p-2 text-end tabular-nums">{Number(i.quantity)}</td><td className="p-2 text-end tabular-nums">{formatSAR(i.unit_price)}</td><td className="p-2 text-end tabular-nums">{formatSAR(i.line_total)}</td>{hasCost && <td className="p-2 text-end tabular-nums text-muted-foreground">{costs[i.id] != null ? formatSAR(costs[i.id] * Number(i.quantity)) : "—"}</td>}</tr>))}</tbody></table></div>
          <div className="ms-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatSAR(o.subtotal)}</span></div>
            {Number(o.shipping_total) > 0 && <div className="flex justify-between"><span>Shipping</span><span className="tabular-nums">{formatSAR(o.shipping_total)}</span></div>}
            <div className="flex justify-between"><span>VAT ({Number(o.vat_rate)}%)</span><span className="tabular-nums">{formatSAR(o.vat_total)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatSAR(o.grand_total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Paid</span><span className="tabular-nums">{formatSAR(o.amount_paid)}</span></div>
            {due > 0.005 && <div className="flex justify-between font-medium text-destructive"><span>Balance due</span><span className="tabular-nums">{formatSAR(due)}</span></div>}
            {hasCost && <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground"><span>Profit (ex-VAT, on known costs)</span><span className="tabular-nums">{formatSAR(profit)} ({Number(o.subtotal) ? ((profit / Number(o.subtotal)) * 100).toFixed(1) : 0}%)</span></div>}
          </div>
        </Panel>

        <Panel title="Payments" actions={<Button size="sm" variant="outline" onClick={() => { setPay({ method: o.payment_method, amount: due > 0 ? due.toFixed(2) : "", ref: "", note: "" }); setPayOpen(true); }}><Plus className="size-4" />Record payment</Button>}>
          {!o.payments.length ? <p className="text-sm text-muted-foreground">No payments recorded. Preferred method: <strong>{String(o.payment_method).replace(/_/g, " ")}</strong>.</p> : (
            <ul className="divide-y text-sm">{o.payments.map((p: any) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{formatSAR(p.amount)}</strong> · {String(p.method).replace(/_/g, " ")}{p.gateway_reference && <span className="font-mono text-xs text-muted-foreground"> · {p.gateway_reference}</span>}</span><span className="text-xs text-muted-foreground">{formatDateTime(p.paid_at)}{p.note && ` · ${p.note}`}</span></li>)}</ul>)}
        </Panel>

        <Panel title="Delivery tracking" actions={<Button size="sm" variant="outline" onClick={() => setShipOpen({ id: null, carrier: "", tracking_number: "", tracking_url: "", status: "preparing", note: "" })}><Plus className="size-4" />Add shipment</Button>}>
          {!o.shipments.length ? <p className="text-sm text-muted-foreground">No shipments yet. Delivery method: <strong className="capitalize">{o.delivery_method}</strong>.</p> : (
            <ul className="divide-y text-sm">{o.shipments.map((s: any) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{s.carrier || "—"} {s.tracking_number && <span className="font-mono text-xs">· {s.tracking_number}</span>} <Badge variant="info">{s.status}</Badge></span><Button size="sm" variant="ghost" onClick={() => setShipOpen({ ...s, carrier: s.carrier ?? "", tracking_number: s.tracking_number ?? "", tracking_url: s.tracking_url ?? "", note: s.note ?? "" })}>Update</Button></li>)}</ul>)}
        </Panel>

        <Panel title="Status history"><ol className="space-y-2 border-s ps-4 text-sm">{[...o.order_status_history].sort((a: any, b: any) => b.id - a.id).map((h: any) => <li key={h.id}><StatusBadge status={h.status} /> <span className="text-xs text-muted-foreground">{h.profiles?.full_name ?? "customer/system"} · {formatDateTime(h.created_at)}{h.note ? ` · ${h.note}` : ""}</span></li>)}</ol></Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Update status">
          <div className="space-y-3"><NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Order status">{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</NativeSelect>
            <Input placeholder="Note (optional)" value={snote} onChange={(e) => setSnote(e.target.value)} />
            <Button disabled={status === o.status} className="w-full" onClick={async () => { if (["cancelled", "refunded"].includes(status) && !confirm("Cancelling releases the reserved stock. Continue?")) return; if (await run(setOrderStatus(o.id, status, snote || null), "Status updated")) { setSnote(""); refresh(); } }}>Update status</Button>
            <p className="text-xs text-muted-foreground">Shipped / ready / delivered deducts the reserved stock. Cancelled / refunded releases it.</p></div>
        </Panel>
        <Panel title="Invoice">
          {invoice ? <div className="space-y-2 text-sm"><p className="font-mono font-semibold">{invoice.invoice_number}</p><p className="text-xs text-muted-foreground">Issued {formatDateTime(invoice.issued_at)} · ZATCA: {String(invoice.zatca_status).replace(/_/g, " ")}</p>
            <Button variant="outline" asChild className="w-full"><a href={`/api/invoice/${invoice.id}/pdf`} target="_blank"><FileDown className="size-4" />Download VAT invoice PDF</a></Button></div>
            : <Button className="w-full" onClick={async () => { if (confirm("Issue the VAT invoice? Issued invoices cannot be edited.") && (await run(issueInvoice(o.id), "Invoice issued"))) refresh(); }}><FileText className="size-4" />Issue VAT invoice</Button>}
          <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">ZATCA e-invoicing (Fatoora) is <strong>not integrated</strong>. These PDFs are not ZATCA-compliant e-invoices (no QR/XML/clearance). The database is prepared for it; integration must be built and certified before you rely on it.</p>
        </Panel>
        <Panel title="Customer">
          <p className="font-semibold">{o.company_name || o.customer_name}</p>{o.company_name && <p className="text-sm">{o.customer_name}</p>}<p className="text-sm">{o.customer_email}</p>{o.customer_phone && <p className="text-sm" dir="ltr">{o.customer_phone}</p>}{o.customer_vat_number && <p className="text-xs text-muted-foreground">VAT: {o.customer_vat_number}</p>}
          {addr && <p className="mt-2 rounded-md bg-muted p-2 text-sm">{[addr.recipient, addr.line1, addr.line2, addr.city, addr.region, addr.postal_code].filter(Boolean).join(", ")}{addr.phone && <><br /><span dir="ltr">{addr.phone}</span></>}</p>}
          {o.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{o.notes}”</p>}
        </Panel>
        <Panel title="Internal notes (staff only)">
          <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" /><Button onClick={async () => { if (await run(addInternalNote("order", o.id, note), "Note added")) { setNote(""); refresh(); } }}>Add</Button></div>
          <ul className="mt-3 space-y-2 text-sm">{notes.map((n) => <li key={n.id} className="rounded-md bg-muted p-2"><p className="whitespace-pre-line">{n.note}</p><p className="mt-1 text-xs text-muted-foreground">{n.by ?? "—"} · {formatDateTime(n.at)}</p></li>)}</ul>
        </Panel>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}><DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Balance due: {formatSAR(due)}. Payment status updates automatically.</DialogDescription></DialogHeader>
        <div className="grid gap-3"><Field label="Method"><NativeSelect value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}</NativeSelect></Field>
          <Field label="Amount (SAR, incl. VAT)"><Input type="number" min={0} step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Reference (transfer no., receipt…)"><Input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} /></Field><Field label="Note"><Textarea rows={2} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field></div>
        <DialogFooter><Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button disabled={!pay.amount} onClick={async () => { if (await run(recordPayment(o.id, { method: pay.method, amount: Number(pay.amount), reference: pay.ref || null, note: pay.note || null }), "Payment recorded")) { setPayOpen(false); refresh(); } }}>Save payment</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={!!shipOpen} onOpenChange={(v) => !v && setShipOpen(null)}><DialogContent>
        <DialogHeader><DialogTitle>{shipOpen?.id ? "Update shipment" : "New shipment"}</DialogTitle></DialogHeader>
        {shipOpen && <div className="grid gap-3"><Field label="Carrier"><Input value={shipOpen.carrier} onChange={(e) => setShipOpen({ ...shipOpen, carrier: e.target.value })} /></Field><Field label="Tracking number"><Input value={shipOpen.tracking_number} onChange={(e) => setShipOpen({ ...shipOpen, tracking_number: e.target.value })} /></Field>
          <Field label="Tracking link (https://…)"><Input dir="ltr" value={shipOpen.tracking_url} onChange={(e) => setShipOpen({ ...shipOpen, tracking_url: e.target.value })} /></Field>
          <Field label="Status"><NativeSelect value={shipOpen.status} onChange={(e) => setShipOpen({ ...shipOpen, status: e.target.value })}>{["preparing", "dispatched", "in_transit", "delivered", "returned"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</NativeSelect></Field></div>}
        <DialogFooter><Button variant="outline" onClick={() => setShipOpen(null)}>Cancel</Button><Button onClick={async () => { if (await run(saveShipment(o.id, shipOpen.id, { carrier: shipOpen.carrier || null, tracking_number: shipOpen.tracking_number || null, tracking_url: shipOpen.tracking_url || null, status: shipOpen.status, note: shipOpen.note || null }), "Shipment saved")) { setShipOpen(null); refresh(); } }}>Save</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
