"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, type Result } from "./common";

const uuid = z.string().uuid();
const refresh = (p: string) => { revalidatePath(p); revalidatePath("/admin"); revalidatePath("/", "layout"); };

// ───────── RFQ / quotations ─────────
const quoteSchema = z.object({
  lines: z.array(z.object({ id: uuid, unit_price: z.number().min(0).max(100_000_000).nullable(), lead_time: z.string().trim().max(100).nullable() })).min(1).max(200),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), lead_time: z.string().trim().max(200).nullable(), payment_terms: z.string().trim().max(500).nullable(),
  delivery_terms: z.string().trim().max(500).nullable(), notes: z.string().trim().max(3000).nullable(), markQuoted: z.boolean(),
});
export async function saveQuotation(rfqId: string, input: z.input<typeof quoteSchema>): Promise<Result> {
  await requireStaff();
  if (!uuid.safeParse(rfqId).success) return fail("Invalid quotation.");
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the prices and dates.");
  const d = parsed.data;
  if (d.markQuoted) {
    if (d.lines.some((l) => l.unit_price == null)) return fail("Every line needs a price before the quotation can be marked as quoted. (Prices are never filled in automatically.)");
    if (!d.valid_until) return fail("Set a validity date.");
    if (new Date(d.valid_until) < new Date(new Date().toISOString().slice(0, 10))) return fail("The validity date is in the past.");
  }
  const sb = await createClient();
  const { error } = await sb.rpc("admin_save_quotation", { p_rfq: rfqId, p_lines: d.lines.map((l) => ({ id: l.id, unit_price: l.unit_price == null ? "" : l.unit_price, lead_time: l.lead_time ?? "" })), p_valid_until: d.valid_until, p_lead_time: d.lead_time, p_payment_terms: d.payment_terms, p_delivery_terms: d.delivery_terms, p_notes: d.notes, p_mark_quoted: d.markQuoted });
  if (error) return fail(error.message);
  refresh(`/admin/rfqs/${rfqId}`);
  return ok(null);
}
export async function setRfqStatus(rfqId: string, status: "under_review" | "rejected" | "cancelled" | "accepted" | "expired", note?: string): Promise<Result> {
  const user = await requireStaff();
  const sb = await createClient();
  const { error } = await sb.from("rfqs").update({ status }).eq("id", rfqId);
  if (error) return fail(error.message);
  await sb.from("rfq_events").insert({ rfq_id: rfqId, event: `status:${status}`, detail: note ?? null, actor: user.id });
  refresh(`/admin/rfqs/${rfqId}`);
  return ok(null);
}
export async function convertRfqToOrder(rfqId: string, delivery: "delivery" | "pickup"): Promise<Result<{ orderId: string }>> {
  await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_convert_rfq", { p_rfq: rfqId, p_delivery: delivery });
  if (error) return fail(error.message);
  refresh(`/admin/rfqs/${rfqId}`); revalidatePath("/admin/orders");
  return ok({ orderId: data as string });
}
export async function addInternalNote(entity: "order" | "rfq" | "customer", entityId: string, note: string): Promise<Result> {
  const user = await requireStaff();
  if (!uuid.safeParse(entityId).success || !note.trim()) return fail("Write a note first.");
  const sb = await createClient();
  const { error } = await sb.from("internal_notes").insert({ entity, entity_id: entityId, note: note.trim().slice(0, 3000), created_by: user.id });
  if (error) return fail(error.message);
  revalidatePath(`/admin/${entity === "order" ? "orders" : entity === "rfq" ? "rfqs" : "customers"}/${entityId}`);
  return ok(null);
}

// ───────── Orders ─────────
export async function setOrderStatus(orderId: string, status: string, note: string | null): Promise<Result> {
  await requireStaff();
  const ok_ = z.enum(["pending", "confirmed", "processing", "ready_for_pickup", "shipped", "delivered", "completed", "cancelled", "refunded"]).safeParse(status);
  if (!ok_.success) return fail("Invalid status.");
  const sb = await createClient();
  const { error } = await sb.rpc("admin_set_order_status", { p_order: orderId, p_status: ok_.data, p_note: note?.trim() || null });
  if (error) return fail(error.message);
  refresh(`/admin/orders/${orderId}`); revalidatePath("/admin/inventory");
  return ok(null);
}
export async function recordPayment(orderId: string, input: { method: string; amount: number; reference: string | null; note: string | null }): Promise<Result> {
  await requireStaff();
  const p = z.object({ method: z.enum(["bank_transfer", "cod", "card", "mada", "apple_pay", "stc_pay", "credit_account", "other"]), amount: z.number().positive().max(100_000_000), reference: z.string().trim().max(100).nullable(), note: z.string().trim().max(300).nullable() }).safeParse(input);
  if (!p.success) return fail("Enter a valid amount.");
  const sb = await createClient();
  const { error } = await sb.rpc("admin_record_payment", { p_order: orderId, p_method: p.data.method, p_amount: p.data.amount, p_reference: p.data.reference, p_note: p.data.note });
  if (error) return fail(error.message);
  refresh(`/admin/orders/${orderId}`);
  return ok(null);
}
export async function saveShipment(orderId: string, shipmentId: string | null, input: { carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string; note: string | null }): Promise<Result> {
  await requireStaff();
  const p = z.object({ carrier: z.string().trim().max(100).nullable(), tracking_number: z.string().trim().max(100).nullable(), tracking_url: z.string().trim().max(500).nullable().refine((v) => !v || /^https?:\/\//i.test(v), "Tracking link must start with http(s)://"), status: z.enum(["preparing", "dispatched", "in_transit", "delivered", "returned"]), note: z.string().trim().max(300).nullable() }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the shipment.");
  const sb = await createClient(); const now = new Date().toISOString();
  const row = { ...p.data, order_id: orderId, shipped_at: ["dispatched", "in_transit", "delivered"].includes(p.data.status) ? now : null, delivered_at: p.data.status === "delivered" ? now : null };
  const { error } = shipmentId ? await sb.from("shipments").update(row).eq("id", shipmentId) : await sb.from("shipments").insert(row);
  if (error) return fail(error.message);
  refresh(`/admin/orders/${orderId}`);
  return ok(null);
}
export async function issueInvoice(orderId: string): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_issue_invoice", { p_order: orderId });
  if (error) return fail(error.message);
  await audit(sb, user.id, "invoice.issue", "invoices", data as string);
  refresh(`/admin/orders/${orderId}`);
  return ok({ id: data as string });
}
