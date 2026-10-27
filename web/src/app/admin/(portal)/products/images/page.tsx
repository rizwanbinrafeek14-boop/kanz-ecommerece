import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { BulkImageUpload } from "@/components/admin/bulk-image-upload";

export const metadata = { title: "Product images" };

export default async function ProductImagesPage() {
  await requireStaff();
  const sb = await createClient();
  const [none, temp, photo] = await Promise.all((["none", "temporary", "photo"] as const).map((st) => sb.from("products").select("id", { count: "exact", head: true }).eq("image_status", st).then((r) => r.count ?? 0)));
  return (
    <>
      <PageHeader title="Product images" description="Upload your own product photos — one at a time from a product, or many at once here. Products never wait for photos: until one is uploaded the catalogue image or a labelled placeholder is shown." />
      <ul className="mb-5 grid gap-3 sm:grid-cols-3" data-image-counts>
        <li className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold tabular-nums">{none}</p><p className="text-sm text-muted-foreground">No image — placeholder shown</p><Link href="/admin/products?img=none" className="text-sm font-medium text-primary underline">Show products</Link></li>
        <li className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold tabular-nums">{temp}</p><p className="text-sm text-muted-foreground">Temporary catalogue image</p><Link href="/admin/products?img=temporary" className="text-sm font-medium text-primary underline">Show products</Link></li>
        <li className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold tabular-nums">{photo}</p><p className="text-sm text-muted-foreground">With your own photo</p><Link href="/admin/products?img=photo" className="text-sm font-medium text-primary underline">Show products</Link></li>
      </ul>
      <BulkImageUpload />
    </>
  );
}
