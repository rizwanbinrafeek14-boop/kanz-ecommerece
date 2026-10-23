import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Products" };
const PAGE = 25;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cat?: string; page?: string; quote?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  const { data: cats } = await sb.from("categories").select("id, slug, name_en, parent_id, sort_order").order("sort_order");
  let q = sb.from("products").select("id, name_en, sku, slug, status, base_price, is_quote_only, category_id, updated_at, product_images(storage_path, is_primary, needs_hires), product_variants(id)", { count: "exact" });
  if (sp.q) { const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`name_en.ilike.%${t}%,name_ar.ilike.%${t}%,sku.ilike.%${t}%`); }
  if (sp.status) q = q.eq("status", sp.status as "draft");
  if (sp.quote === "1") q = q.eq("is_quote_only", true); if (sp.quote === "0") q = q.eq("is_quote_only", false);
  if (sp.cat) {
    const ids = new Set([sp.cat]); let grew = true;
    while (grew) { grew = false; for (const c of cats ?? []) if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true; } }
    q = q.in("category_id", [...ids]);
  }
  const { data, count } = await q.order("updated_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const pids = (data ?? []).map((p) => p.id);
  const { data: av } = pids.length ? await sb.from("variant_availability").select("product_id, available").in("product_id", pids) : { data: [] };
  const avail = new Map<string, number>(); (av ?? []).forEach((a) => avail.set(a.product_id, (avail.get(a.product_id) ?? 0) + Number(a.available)));
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name_en]));
  const rows: ProductRow[] = (data ?? []).map((p: any) => {
    const imgs = (p.product_images ?? []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary));
    return { id: p.id, name_en: p.name_en, sku: p.sku, slug: p.slug, status: p.status, base_price: p.base_price, is_quote_only: p.is_quote_only, category: catName.get(p.category_id) ?? null, image: imgs[0]?.storage_path ?? null, variants: p.product_variants?.length ?? 0, available: p.product_variants?.length ? avail.get(p.id) ?? 0 : null, updated_at: p.updated_at, needs_hires: !!imgs[0]?.needs_hires };
  });
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (n: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.cat ? { cat: sp.cat } : {}), ...(sp.quote ? { quote: sp.quote } : {}), page: String(n) })}`;
  return (
    <>
      <PageHeader title="Products" description={`${count ?? 0} product${count === 1 ? "" : "s"}. Changes appear on the website immediately.`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search name or SKU…" className="max-w-xs" />
        <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-40"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></NativeSelect>
        <NativeSelect name="cat" defaultValue={sp.cat ?? ""} className="w-56"><option value="">All categories</option>{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "   ↳ " : ""}{c.name_en}</option>)}</NativeSelect>
        <NativeSelect name="quote" defaultValue={sp.quote ?? ""} className="w-44"><option value="">Quote + priced</option><option value="1">Quote only</option><option value="0">Priced</option></NativeSelect>
        <Button variant="secondary">Filter</Button>
      </form>
      <ProductsTable rows={rows} isAdmin={user.role === "admin"} />
      {pages > 1 && <nav className="mt-4 flex flex-wrap justify-center gap-1">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={href(n)} className={`flex size-9 items-center justify-center rounded-md border text-sm ${n === page ? "bg-ink text-white" : "hover:bg-accent"}`}>{n}</Link>)}</nav>}
    </>
  );
}
