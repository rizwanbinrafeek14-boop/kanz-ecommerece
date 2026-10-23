import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDateTime, formatSAR } from "@/lib/format";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data: c } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: orders }, { data: rfqs }, { data: addrs }] = await Promise.all([
    sb.from("orders").select("id, order_number, status, payment_status, grand_total, created_at, customer_email").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("rfqs").select("id, rfq_number, status, quoted_total, created_at, contact_email").eq("user_id", id).order("created_at", { ascending: false }), sb.from("addresses").select("*").eq("user_id", id),
  ]);
  const email = orders?.[0]?.customer_email ?? rfqs?.[0]?.contact_email ?? null;
  const spend = (orders ?? []).filter((o) => !["cancelled", "refunded"].includes(o.status)).reduce((n, o) => n + Number(o.grand_total), 0);
  return (<>
    <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Customers</Link>
    <PageHeader title={c.full_name || "Customer"} description={c.company_name ?? undefined} />
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Details"><dl className="space-y-1.5 text-sm"><div><dt className="text-xs text-muted-foreground">Email</dt><dd>{email ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Phone</dt><dd dir="ltr" className="text-start">{c.phone ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">VAT no. / CR</dt><dd>{c.vat_number ?? "—"} / {c.cr_number ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Joined</dt><dd>{formatDateTime(c.created_at)}</dd></div><div><dt className="text-xs text-muted-foreground">Lifetime spend</dt><dd className="font-semibold">{formatSAR(spend)}</dd></div></dl>
        {addrs?.length ? <div className="mt-4"><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Addresses</p>{addrs.map((a) => <p key={a.id} className="text-sm">{[a.line1, a.city, a.region].filter(Boolean).join(", ")}</p>)}</div> : null}</Panel>
      <Panel title={`Orders (${orders?.length ?? 0})`} className="lg:col-span-2">{orders?.length ? <ul className="divide-y text-sm">{orders.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-primary"><span className="font-mono">{o.order_number}</span><span className="flex gap-1"><StatusBadge status={o.status} /><StatusBadge status={o.payment_status} /></span><span className="tabular-nums">{formatSAR(o.grand_total)}</span></Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No orders.</p>}</Panel>
      <Panel title={`Quotations (${rfqs?.length ?? 0})`} className="lg:col-span-3">{rfqs?.length ? <ul className="divide-y text-sm">{rfqs.map((r) => <li key={r.id}><Link href={`/admin/rfqs/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-primary"><span className="font-mono">{r.rfq_number}</span><StatusBadge status={r.status} /><span className="tabular-nums">{r.quoted_total != null ? formatSAR(r.quoted_total) : "—"}</span></Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No quotations.</p>}</Panel>
    </div></>);
}
