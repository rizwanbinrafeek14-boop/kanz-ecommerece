import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderWorkbench } from "@/components/admin/order-workbench";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data: o } = await sb.from("orders").select("*, order_items(*), order_status_history(*, profiles(full_name)), payments(*), shipments(*), invoices(id, invoice_number, issued_at, zatca_status), rfqs!orders_rfq_fk(id, rfq_number)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const itemIds = (o.order_items as { id: string }[]).map((i) => i.id);
  const [{ data: costs }, { data: notes }] = await Promise.all([
    itemIds.length ? sb.from("order_item_costs").select("order_item_id, unit_cost").in("order_item_id", itemIds) : Promise.resolve({ data: [] }),
    sb.from("internal_notes").select("id, note, created_at, profiles(full_name)").eq("entity", "order").eq("entity_id", id).order("created_at", { ascending: false }),
  ]);
  return (<>
    <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Orders</Link>
    <PageHeader title={o.order_number} description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={o.status} /><StatusBadge status={o.payment_status} />{o.rfqs && <Link className="text-primary underline" href={`/admin/rfqs/${(o.rfqs as any).id}`}>from {(o.rfqs as any).rfq_number}</Link>}</span>} />
    <OrderWorkbench order={o as any} costs={Object.fromEntries((costs ?? []).map((c) => [c.order_item_id, Number(c.unit_cost)]))} notes={(notes ?? []).map((n: any) => ({ id: n.id, note: n.note, at: n.created_at, by: n.profiles?.full_name ?? null }))} />
  </>);
}
