import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  const sb = await createClient();
  const [{ data: cats }, { data: brands }] = await Promise.all([sb.from("categories").select("id, name_en, parent_id, sort_order").order("sort_order"), sb.from("brands").select("id, name").order("name")]);
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Products</Link>
      <PageHeader title="New product" description="Create the basics first; pricing, variants, images and documents unlock after saving." />
      <ProductEditor product={null} categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name_en, parent_id: c.parent_id }))} brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name }))} variants={[]} attrDefs={[]} attrValues={[]} images={[]} docs={[]} related={[]} alternatives={[]} isAdmin={false} allCerts={[]} certIds={[]} />
    </>
  );
}
