import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSAR } from "@/lib/format";

export const metadata = { title: "Customers" };
const PAGE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1); const sb = await createClient();
  let q = sb.from("profiles").select("id, full_name, company_name, phone, vat_number, created_at, is_active", { count: "exact" }).eq("role", "customer");
  if (sp.q) { const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`full_name.ilike.%${t}%,company_name.ilike.%${t}%,phone.ilike.%${t}%`); }
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const ids = (data ?? []).map((c) => c.id);
  const { data: ords } = ids.length ? await sb.from("orders").select("user_id, grand_total, status").in("user_id", ids).not("status", "in", "(cancelled,refunded)") : { data: [] };
  const agg = new Map<string, { n: number; total: number }>(); (ords ?? []).forEach((o) => { const a = agg.get(o.user_id!) ?? { n: 0, total: 0 }; a.n++; a.total += Number(o.grand_total); agg.set(o.user_id!, a); });
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (<>
    <PageHeader title="Customers" description={`${count ?? 0} registered customer account(s). Email addresses are shown on each customer's page.`} />
    <form className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q} placeholder="Search name, company, phone…" className="max-w-xs" /><Button variant="secondary">Search</Button></form>
    <div className="overflow-hidden rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>VAT no.</TableHead><TableHead className="text-end">Orders</TableHead><TableHead className="text-end">Spend</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
      <TableBody>{(data ?? []).map((c) => { const a = agg.get(c.id); return (
        <TableRow key={c.id}><TableCell><Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-primary">{c.full_name || "—"}</Link>{c.company_name && <span className="text-muted-foreground"> · {c.company_name}</span>}{!c.is_active && <Badge variant="secondary" className="ms-2">disabled</Badge>}</TableCell>
          <TableCell dir="ltr" className="text-start">{c.phone ?? "—"}</TableCell><TableCell className="font-mono text-xs">{c.vat_number ?? "—"}</TableCell><TableCell className="text-end tabular-nums">{a?.n ?? 0}</TableCell><TableCell className="text-end tabular-nums">{formatSAR(a?.total ?? 0)}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</TableCell></TableRow>); })}
        {!data?.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No customers yet.</TableCell></TableRow>}</TableBody></Table></div>
    {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(n) })}`} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
  </>);
}
