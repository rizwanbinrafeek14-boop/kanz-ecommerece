import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { WarehouseManager } from "@/components/admin/warehouse-manager";

export const metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const user = await requireStaff(); const sb = await createClient();
  const { data } = await sb.from("warehouses").select("*").order("is_default", { ascending: false }).order("code");
  return (<>
    <Link href="/admin/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Inventory</Link>
    <PageHeader title="Warehouses" description="Orders reserve stock from the default warehouse first, then from others with enough available quantity." />
    <WarehouseManager canEdit={user.role === "admin"} rows={(data ?? []).map((w) => ({ id: w.id, code: w.code, name: w.name, city: w.city ?? "", is_default: w.is_default, is_active: w.is_active }))} /></>);
}
