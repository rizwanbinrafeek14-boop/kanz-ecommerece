import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { BrandManager } from "@/components/admin/brand-manager";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const user = await requireStaff(); const sb = await createClient();
  const { data } = await sb.from("brands").select("*").order("sort_order").order("name");
  return (<><PageHeader title="Brands" description="Brand logos for the homepage strip. Only add brands you are authorised to display." /><BrandManager isAdmin={user.role === "admin"} brands={data ?? []} /></>);
}
