import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { SocialManager, type WidgetRow } from "@/components/admin/social-manager";
import type { SocialLinkRow } from "@/components/social-icon";

export const metadata = { title: "Social Media & Contact Settings" };

export default async function SocialPage() {
  const sb = await createClient();
  const [{ data: w }, { data: links }] = await Promise.all([sb.from("contact_widget").select("*").eq("id", 1).single(), sb.from("social_links").select("*").order("sort_order")]);
  return (<><PageHeader title="Social Media & Contact Settings" description="Control the WhatsApp / contact button and the social links shown across the website. Everything here is stored in the database; nothing is hardcoded." />
    {w ? <SocialManager widget={w as WidgetRow} links={(links ?? []) as SocialLinkRow[]} /> : <p className="text-sm text-destructive">Run migration 0010 in the Supabase SQL Editor first.</p>}</>);
}
