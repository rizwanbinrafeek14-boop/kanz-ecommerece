import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ContentManager } from "@/components/admin/content-manager";

export const metadata = { title: "Content & settings" };

export default async function ContentPage() {
  const user = await requireStaff(); const sb = await createClient();
  const [{ data: sec }, { data: ann }, { data: links }, { data: set }] = await Promise.all([
    sb.from("homepage_sections").select("*").order("sort_order"), sb.from("announcements").select("*").order("sort_order"), sb.from("menu_links").select("*").order("menu").order("sort_order"), sb.from("site_settings").select("key, value"),
  ]);
  return (<><PageHeader title="Website content & settings" description="Edit the homepage, announcements, menus, company information, VAT and SEO — no code needed." />
    <ContentManager isAdmin={user.role === "admin"} sections={(sec ?? []).map((s) => ({ ...s, limit: Number((s.config as { limit?: number })?.limit ?? 8) }))} announcements={ann ?? []} links={links ?? []} settings={Object.fromEntries((set ?? []).map((r) => [r.key, r.value]))} /></>);
}
