import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, Empty } from "@/components/admin/ui";
import { RfqAge } from "@/components/admin/rfq-age";
import { RfqOwner } from "@/components/admin/rfq-owner";
import { OPEN, staffList } from "@/lib/admin/rfq-list";
import { formatSAR } from "@/lib/format";

const HOUR = 3_600_000, DAY = 24 * HOUR, RIYADH = 3 * HOUR;   // Saudi Arabia: UTC+3 all year
const ymd = (t: number) => new Date(t + RIYADH).toISOString().slice(0, 10);

function Count({ href, label, value, tone, hint }: { href: string; label: string; value: number; tone?: "warn" | "bad"; hint?: string }) {
  const c = !value ? "" : tone === "bad" ? "border-red-300 bg-red-50" : tone === "warn" ? "border-amber-300 bg-amber-50" : "";
  return (<Link href={href} className={`rounded-xl border bg-card p-4 transition hover:border-primary ${c}`} data-today={label}>
    <p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</Link>);
}

/** The quotation work for today, at the top of the dashboard: what needs a reply, who owns it, what is about to expire. */
export async function Today({ sb, me, now }: { sb: Awaited<ReturnType<typeof createClient>>; me: string; now: number }) {
  const midnight = Math.floor((now + RIYADH) / DAY) * DAY - RIYADH;
  const iso = (t: number) => new Date(t).toISOString();
  const head = { count: "exact" as const, head: true };
  const [newToday, over24, unassigned, mine, accepted, waiting, expiring, sent30, won30, staff, dq] = await Promise.all([
    sb.from("rfqs").select("id", head).gte("created_at", iso(midnight)),
    sb.from("rfqs").select("id", head).in("status", [...OPEN]).lt("created_at", iso(now - DAY)),
    sb.from("rfqs").select("id", head).in("status", [...OPEN]).is("assigned_to", null),
    sb.from("rfqs").select("id", head).in("status", [...OPEN]).eq("assigned_to", me),
    sb.from("rfqs").select("id", head).eq("status", "accepted"),
    sb.from("rfqs").select("id, rfq_number, contact_name, company_name, created_at, assigned_to, rfq_items(count)").in("status", [...OPEN]).order("created_at").limit(8),
    sb.from("rfqs").select("id, rfq_number, contact_name, company_name, quote_valid_until, quoted_total").eq("status", "quoted").gte("quote_valid_until", ymd(now)).lte("quote_valid_until", ymd(now + 7 * DAY)).order("quote_valid_until").limit(8),
    sb.from("rfqs").select("id", head).gte("quoted_at", iso(now - 30 * DAY)),
    sb.from("rfqs").select("id", head).gte("quoted_at", iso(now - 30 * DAY)).in("status", ["accepted", "converted"]),
    staffList(sb),
    sb.rpc("admin_data_quality"),
  ]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const fixFirst = ((dq.data ?? []) as { severity: number }[]).filter((r) => r.severity === 1).length;
  const sent = sent30.count ?? 0, won = won30.count ?? 0;
  const daysLeft = (d: string) => Math.round((Date.parse(d) - Date.parse(ymd(now))) / DAY);
  return (
    <section className="mb-8" aria-labelledby="today-h" data-today-section>
      <h2 id="today-h" className="mb-3 text-lg font-semibold">Today</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Count href="/admin/rfqs?status=open" label="New requests today" value={newToday.count ?? 0} />
        <Count href="/admin/rfqs?age=24&sort=old" label="Waiting over 24 h" value={over24.count ?? 0} tone="bad" />
        <Count href="/admin/rfqs?status=open&owner=none&sort=old" label="Open, no owner" value={unassigned.count ?? 0} tone="warn" />
        <Count href="/admin/rfqs?status=open&owner=me&sort=old" label="Mine to quote" value={mine.count ?? 0} />
        <Count href="/admin/rfqs?status=accepted" label="Accepted, to convert" value={accepted.count ?? 0} tone="warn" hint="Turn into orders" />
        <Count href="/admin/data-quality" label="Product data to fix first" value={fixFirst} tone="warn" />
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Panel title="Needs a quotation (oldest first)" actions={<Link href="/admin/rfqs?status=open&sort=old" className="text-sm text-primary hover:underline">All open</Link>}>
          {waiting.data?.length ? <ul className="divide-y text-sm" data-today-waiting>{waiting.data.map((r: any) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <RfqAge createdAt={r.created_at} open now={now} />
              <Link href={`/admin/rfqs/${r.id}`} className="min-w-0 flex-1 truncate hover:text-primary"><span className="font-mono">{r.rfq_number}</span> · {r.company_name || r.contact_name} <span className="text-muted-foreground">({r.rfq_items?.[0]?.count ?? 0} lines)</span></Link>
              {r.assigned_to ? <span className="text-xs text-muted-foreground">{r.assigned_to === me ? "Mine" : names.get(r.assigned_to) ?? "—"}</span> : <RfqOwner rfqId={r.id} owner={null} staff={staff} me={me} compact />}
            </li>))}</ul> : <Empty>No open requests. Well done.</Empty>}
        </Panel>
        <Panel title="Quotations expiring within 7 days" actions={<span className="text-sm text-muted-foreground" data-today-rate>{sent ? `${won} of ${sent} quoted in 30 days accepted (${Math.round((won / sent) * 100)}%)` : "No quotations sent in 30 days"}</span>}>
          {expiring.data?.length ? <ul className="divide-y text-sm" data-today-expiring>{expiring.data.map((r: any) => { const d = daysLeft(r.quote_valid_until); return (
            <li key={r.id}><Link href={`/admin/rfqs/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2 hover:text-primary">
              <span className="truncate"><span className="font-mono">{r.rfq_number}</span> · {r.company_name || r.contact_name}</span>
              <span className="flex items-center gap-3"><span className="tabular-nums">{r.quoted_total != null ? formatSAR(r.quoted_total) : "—"}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${d <= 2 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{d === 0 ? "expires today" : `${d} day${d === 1 ? "" : "s"} left`}</span></span></Link></li>); })}</ul>
            : <Empty>Nothing expiring this week. Follow up on quotations here before they lapse.</Empty>}
        </Panel>
      </div>
    </section>);
}
