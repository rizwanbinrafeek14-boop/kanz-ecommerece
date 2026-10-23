import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager, type Cat } from "@/components/admin/category-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireStaff(); const sb = await createClient();
  const [{ data: cats }, { data: counts }] = await Promise.all([sb.from("categories").select("*").order("sort_order").order("name_en"), sb.from("products").select("category_id").neq("status", "archived")]);
  const n = new Map<string, number>(); (counts ?? []).forEach((p) => p.category_id && n.set(p.category_id, (n.get(p.category_id) ?? 0) + 1));
  return (<><PageHeader title="Categories" description="Two levels: categories and subcategories. Names, images, order and visibility update the website menu and homepage instantly." />
    <CategoryManager isAdmin={user.role === "admin"} cats={(cats ?? []).map((c) => ({ ...c, products: n.get(c.id) ?? 0 })) as Cat[]} /></>);
}
