import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { DqDismiss } from "@/components/admin/dq-dismiss";
import { NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DQ_CHECKS, isDqCheck, type DqCheck } from "@/lib/admin/data-quality";

export const metadata = { title: "Data quality" };
const PAGE = 50;
const SEV = { 1: ["Fix first", "bg-red-100 text-red-800"], 2: ["Should fix", "bg-amber-100 text-amber-900"], 3: ["Nice to have", "bg-muted text-foreground"] } as const;
interface Row { product_id: string; slug: string; name: string; status: string; check_code: DqCheck; severity: 1 | 2 | 3; dismissed: boolean; updated_at: string }

export default async function DataQualityPage({ searchParams }: { searchParams: Promise<{ check?: string; status?: string; dismissed?: string; page?: string }> }) {
  await requireStaff(); const sp = await searchParams; const sb = await createClient();
  const { data, error } = await sb.rpc("admin_data_quality", { p_include_dismissed: sp.dismissed === "1" });
  const all = ((data ?? []) as Row[]).filter((r) => isDqCheck(r.check_code));
  const scoped = all.filter((r) => !sp.status || r.status === sp.status);
  const counts = new Map<string, { n: number; pub: number }>();
  for (const r of scoped.filter((x) => !x.dismissed)) { const c = counts.get(r.check_code) ?? { n: 0, pub: 0 }; c.n++; if (r.status === "published") c.pub++; counts.set(r.check_code, c); }
  const rows = scoped.filter((r) => !isDqCheck(sp.check) || r.check_code === sp.check);
  const page = Math.max(1, Number(sp.page) || 1); const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const keep = (extra: Record<string, string | undefined>) => { const q = new URLSearchParams(Object.entries({ check: sp.check, status: sp.status, dismissed: sp.dismissed, ...extra }).filter(([, v]) => v) as [string, string][]); return `?${q}`; };
  return (<>
    <PageHeader title="Data quality" description="What each product is still missing, most important first. Fix it in the product editor, or mark it as fine when it is intentional." />
    {error && <p className="mb-4 text-sm text-destructive">The checks could not be loaded: {error.message}. Run migration 0025.</p>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-dq-summary>
      {(Object.keys(DQ_CHECKS) as DqCheck[]).map((code) => { const c = counts.get(code); const sev = DQ_CHECKS[code].sev;
        return (<Link key={code} href={keep({ check: sp.check === code ? undefined : code, page: undefined })} data-dq-card={code}
          className={`rounded-xl border bg-card p-4 transition hover:border-primary ${sp.check === code ? "border-primary ring-1 ring-primary" : ""} ${!c ? "bg-muted/30" : ""}`}>
          <div className="flex items-start justify-between gap-2"><p className="font-medium">{DQ_CHECKS[code].label}</p><span className="text-2xl font-bold tabular-nums">{c?.n ?? 0}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{DQ_CHECKS[code].hint}</p>
          <p className="mt-2 text-xs"><span className={`rounded px-1.5 py-0.5 font-semibold ${SEV[sev][1]}`}>{SEV[sev][0]}</span>{c ? <span className="ms-2 text-muted-foreground">{c.pub} published</span> : null}</p></Link>); })}
    </div>
    <form className="mb-4 flex flex-wrap items-center gap-2">
      {sp.check && <input type="hidden" name="check" value={sp.check} />}
      <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-44" aria-label="Product status"><option value="">All products</option><option value="published">Published</option><option value="draft">Drafts</option></NativeSelect>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dismissed" value="1" defaultChecked={sp.dismissed === "1"} />Include items marked fine</label>
      <Button variant="secondary">Filter</Button>{(sp.check || sp.status || sp.dismissed) && <Button asChild variant="ghost"><Link href="/admin/data-quality">Clear</Link></Button>}
    </form>
    <p className="mb-2 text-sm text-muted-foreground" data-dq-count>{rows.length} item{rows.length === 1 ? "" : "s"}{isDqCheck(sp.check) ? ` · ${DQ_CHECKS[sp.check].label}` : ""}</p>
    <div className="overflow-x-auto rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Missing</TableHead><TableHead className="text-end">Action</TableHead></TableRow></TableHeader>
      <TableBody>{rows.slice((page - 1) * PAGE, page * PAGE).map((r) => (
        <TableRow key={r.product_id + r.check_code} data-dq-row={`${r.slug}:${r.check_code}`} className={r.dismissed ? "bg-muted/40" : ""}>
          <TableCell><Link href={`/admin/products/${r.product_id}`} className="font-medium hover:text-primary">{r.name}</Link><p className="font-mono text-xs text-muted-foreground">{r.slug}</p></TableCell>
          <TableCell className="text-sm capitalize">{r.status}</TableCell>
          <TableCell><span className={`me-2 rounded px-1.5 py-0.5 text-xs font-semibold ${SEV[r.severity][1]}`}>{SEV[r.severity][0]}</span>{DQ_CHECKS[r.check_code].label}{r.dismissed && <span className="ms-2 text-xs text-muted-foreground">(marked fine)</span>}</TableCell>
          <TableCell className="whitespace-nowrap text-end"><Button asChild size="sm" variant="outline"><Link href={`/admin/products/${r.product_id}?tab=${DQ_CHECKS[r.check_code].tab}`} data-dq-fix>Fix</Link></Button> <DqDismiss productId={r.product_id} check={r.check_code} dismissed={r.dismissed} /></TableCell>
        </TableRow>))}
        {!rows.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nothing to fix here.</TableCell></TableRow>}</TableBody></Table></div>
    {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={keep({ page: String(n) })} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
  </>);
}
