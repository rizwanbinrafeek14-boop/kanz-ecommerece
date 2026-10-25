import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Panel, Empty } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { scanSuggestions } from "@/lib/families/scan";
import { SuggestionActions, AutoGroupButton } from "@/components/admin/family-manager";

export const metadata = { title: "Product families" };
export const dynamic = "force-dynamic";

const CONF = { exact: ["success", "Exact match"], likely: ["info", "Likely - check"], uncertain: ["warning", "Uncertain - check carefully"] } as const;

export default async function FamiliesPage() {
  await requireStaff(); const sb = await createClient();
  await scanSuggestions(sb);
  const [{ data: fams }, { data: prods }, { data: sugg }] = await Promise.all([
    sb.from("product_families").select("id, slug, name_en, status, product_type").order("sort_order").order("name_en"),
    sb.from("products").select("id, family_id, family_link, status, brands(name)").not("family_id", "is", null),
    sb.from("family_link_suggestions").select("id, confidence, reasons, product_id, family_id, products(name_en, slug, status, brands(name)), product_families(name_en)").eq("status", "pending").order("confidence"),
  ]);
  const byFam = new Map<string, { brand: string; link: string; status: string }[]>();
  for (const p of prods ?? []) { const b = Array.isArray(p.brands) ? p.brands[0] : p.brands; byFam.set(p.family_id!, [...(byFam.get(p.family_id!) ?? []), { brand: (b as { name: string } | null)?.name ?? "?", link: p.family_link, status: p.status }]); }
  const multi = (fams ?? []).filter((f) => (byFam.get(f.id)?.length ?? 0) > 1 || f.status === "published");
  const single = (fams ?? []).filter((f) => !multi.includes(f));
  const pending = (sugg ?? []).filter((s) => (byFam.get(s.family_id)?.length ?? 0) > 1 || s.confidence !== "exact");
  const row = (f: NonNullable<typeof fams>[number]) => {
    const offers = byFam.get(f.id) ?? []; const conf = offers.filter((o) => o.link === "confirmed").length;
    return (
      <li key={f.id} className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
        <div className="min-w-0 flex-1"><Link href={`/admin/families/${f.id}`} className="font-medium hover:underline">{f.name_en}</Link><p className="font-mono text-xs text-muted-foreground">/product/{f.slug}</p></div>
        <p className="text-sm text-muted-foreground">{offers.map((o) => o.brand).join(" · ") || "No offerings"}</p>
        <Badge variant={conf ? "success" : "secondary"}>{conf}/{offers.length} confirmed</Badge>
        <Badge variant={f.status === "published" ? "dark" : "outline"}>{f.status}</Badge>
      </li>);
  };
  return (
    <>
      <PageHeader title="Product families" description="One product page per product type, with a manufacturer selector. Each brand keeps its own sizes, tables, drawings and documents; an offering appears on the family page only after you confirm it."
        actions={<Link href="/admin/families/new" className={buttonVariants()}>New family</Link>} />
      <div className="space-y-6">
        <AutoGroupButton />
        <Panel title={`Match suggestions waiting for a decision (${pending.length})`}>
          {!pending.length ? <Empty>No pending suggestions.</Empty> : (
            <ul className="divide-y">{pending.map((s) => { const p = (Array.isArray(s.products) ? s.products[0] : s.products) as { name_en: string; slug: string; status: string; brands: { name: string } | { name: string }[] | null } | null;
              const fam = (Array.isArray(s.product_families) ? s.product_families[0] : s.product_families) as { name_en: string } | null; const c = CONF[s.confidence as keyof typeof CONF];
              return (
                <li key={s.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <p className="text-sm"><span className="font-medium">{p?.name_en}</span> <span className="text-muted-foreground">→ family</span> <Link href={`/admin/families/${s.family_id}`} className="font-medium underline">{fam?.name_en}</Link> <Badge variant={c[0]}>{c[1]}</Badge> {p?.status !== "published" && <Badge variant="outline">product is {p?.status}</Badge>}</p>
                    <ul className="mt-1 list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">{(s.reasons as string[]).map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                  <SuggestionActions productId={s.product_id} />
                </li>); })}</ul>)}
        </Panel>
        <Panel title={`Families with several manufacturers or a live page (${multi.length})`}>{multi.length ? <ul>{multi.map(row)}</ul> : <Empty>None yet.</Empty>}</Panel>
        <Panel title={`Single-manufacturer families (${single.length})`}>{single.length ? <ul>{single.map(row)}</ul> : <Empty>None.</Empty>}</Panel>
      </div>
    </>
  );
}
