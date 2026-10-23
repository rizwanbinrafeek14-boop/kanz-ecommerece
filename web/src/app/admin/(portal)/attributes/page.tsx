import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { AttributeManager } from "@/components/admin/attribute-manager";

export const metadata = { title: "Attributes" };

export default async function AttributesPage() {
  const user = await requireStaff(); const sb = await createClient();
  const { data } = await sb.from("attribute_defs").select("*").order("sort_order");
  return (<><PageHeader title="Product attributes" description="Define the specification fields and storefront filters." />
    <AttributeManager isAdmin={user.role === "admin"} rows={(data ?? []).map((d) => ({ id: d.id, key: d.key, name_en: d.name_en, name_ar: d.name_ar ?? "", is_filterable: d.is_filterable, show_in_specs: d.show_in_specs, sort_order: d.sort_order }))} /></>);
}
