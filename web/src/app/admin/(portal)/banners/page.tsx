import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { BannerManager, type BannerRow } from "@/components/admin/banner-manager";

export const metadata = { title: "Banners" };

export default async function BannersPage() {
  const sb = await createClient();
  const [{ data }, { data: cats }] = await Promise.all([sb.from("banners").select("*").order("placement").order("sort_order"), sb.from("categories").select("id, name_en").order("sort_order")]);
  return (<><PageHeader title="Advertisement banners" description="Upload promotions and choose where they appear. Schedules use Saudi time. Impressions and clicks are counted from real visitors." />
    <BannerManager banners={(data ?? []) as BannerRow[]} categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name_en }))} /></>);
}
