import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Stat } from "@/components/admin/ui";
import { DetectionPanel, MaterialsWorkbench, MaterialTypes, type MaterialRow, type WorkbenchRow } from "@/components/admin/material-manager";
import { cn } from "@/lib/utils";

export const metadata = { title: "Materials" };
export const dynamic = "force-dynamic";

const FILTERS = [["all", "All products"], ["missing", "Missing material"], ["unverified", "Needs verification"], ["auto", "Auto-detected (not yet approved)"], ["verified", "Verified"], ["nogrades", "Missing grades"]] as const;

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ show?: string; m?: string; q?: string }> }) {
  const sp = await searchParams; const user = await requireStaff(); const sb = await createClient();
  const show = FILTERS.some(([k]) => k === sp.show) ? sp.show! : "missing";
  const [{ data: types }, { data: prods }, { data: mats }] = await Promise.all([
    sb.from("material_types").select("code, name_en, name_ar, sort_order, is_custom").order("sort_order"),
    sb.from("products").select("id, name_en, status, brands(name)").neq("status", "archived").order("name_en").limit(5000),
    sb.from("product_materials").select("product_id, material_code, grades, status, source, note, edited_by_admin").limit(20000),
  ]);
  const M = new Map<string, MaterialRow[]>(); for (const m of mats ?? []) M.set(m.product_id, [...(M.get(m.product_id) ?? []), m as MaterialRow]);
  const pub = (r: MaterialRow) => r.status === "auto" || r.status === "verified";
  const all: WorkbenchRow[] = (prods ?? []).map((p) => ({ id: p.id, name: p.name_en, status: p.status, brand: ((Array.isArray(p.brands) ? p.brands[0] : p.brands) as { name: string } | null)?.name ?? null, materials: M.get(p.id) ?? [] }));
  const test: Record<string, (r: WorkbenchRow) => boolean> = {
    all: () => true, missing: (r) => !r.materials.some(pub), unverified: (r) => r.materials.some((m) => m.status === "unverified"), auto: (r) => r.materials.some((m) => m.status === "auto"),
    verified: (r) => r.materials.some((m) => m.status === "verified"), nogrades: (r) => r.materials.some((m) => pub(m) && !m.grades.length && !["GI", "HDPE", "PVC", "CPVC", "PPR", "OTHER"].includes(m.material_code)),
  };
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all.filter(test[show]).filter((r) => !sp.m || r.materials.some((m) => m.material_code === sp.m && m.status !== "rejected")).filter((r) => !q || `${r.name} ${r.brand}`.toLowerCase().includes(q));
  const href = (k: string) => `/admin/materials?show=${k}${sp.m ? `&m=${sp.m}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <>
      <PageHeader title="Materials" description="Material classification of every manufacturer offering. The shop's Material filter, the material badges on product cards and the Material selector on product pages use only verified and auto-detected materials. Products without one show as “Material Not Verified” here." />
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="With a shown material" value={all.filter((r) => r.materials.some(pub)).length} hint={`of ${all.length} products`} />
          <Stat label="Material Not Verified" value={all.filter(test.missing).length} tone={all.some(test.missing) ? "warn" : undefined} />
          <Stat label="Detections to review" value={all.filter(test.unverified).length} tone={all.some(test.unverified) ? "warn" : undefined} />
          <Stat label="Missing grades" value={all.filter(test.nogrades).length} />
        </div>
        <DetectionPanel />
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Show">
          {FILTERS.map(([k, label]) => <Link key={k} href={href(k)} className={cn("rounded-full border px-3 py-1 text-sm", k === show ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")} aria-current={k === show ? "page" : undefined}>{label} ({all.filter(test[k]).length})</Link>)}
          <form className="ms-auto flex gap-2" action="/admin/materials"><input type="hidden" name="show" value={show} />
            <select name="m" defaultValue={sp.m ?? ""} aria-label="Material" className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Any material</option>{(types ?? []).map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}</select>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search product or brand" aria-label="Search" className="h-9 rounded-md border bg-background px-2 text-sm" />
            <button className="h-9 rounded-md border px-3 text-sm">Filter</button></form>
        </div>
        <MaterialsWorkbench rows={rows.slice(0, 500)} types={types ?? []} />
        {rows.length > 500 && <p className="text-sm text-muted-foreground">Showing the first 500 of {rows.length}; narrow the filter to see the rest.</p>}
        <MaterialTypes types={types ?? []} isAdmin={user.role === "admin"} />
      </div>
    </>
  );
}
