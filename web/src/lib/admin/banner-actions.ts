"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const opt = (n: number) => z.string().trim().max(n).nullable();
const linkOk = (v: string | null) => v == null || /^\/(?!\/)/.test(v) || /^https:\/\//i.test(v);   // relative path or https only (no javascript:, no //)
const bannerSchema = z.object({
  placement: z.enum(["home_hero", "home_secondary", "home_strip", "category_top", "sidebar", "popup"]),
  title_en: opt(150), title_ar: opt(150), subtitle_en: opt(250), subtitle_ar: opt(250), cta_label_en: opt(40), cta_label_ar: opt(40), alt_en: opt(200), alt_ar: opt(200),
  desktop_image_path: opt(300), mobile_image_path: opt(300), link_url: opt(500).refine(linkOk, "Link must start with / (inside the site) or https://"),
  category_id: z.string().uuid().nullable(), starts_at: z.string().nullable(), ends_at: z.string().nullable(), is_active: z.boolean(), sort_order: z.number().int().min(0).max(100000),
});
export type BannerInput = z.input<typeof bannerSchema>;

export async function saveBanner(id: string | null, input: BannerInput): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const d = parsed.data;
  if (!d.desktop_image_path && !d.mobile_image_path) return fail("Upload at least a desktop image.");
  if (d.placement === "category_top" && !d.category_id) return fail("Choose the category this banner belongs to.");
  if (d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at)) return fail("The end date must be after the start date.");
  const sb = await createClient();
  if (id) { const { error } = await sb.from("banners").update(d).eq("id", id); if (error) return fail(error.message); }
  else { const { data, error } = await sb.from("banners").insert(d).select("id").single(); if (error || !data) return fail(error?.message ?? "Could not save"); id = data.id; }
  await audit(sb, user.id, "banner.save", "banners", id!);
  refreshStorefront(); revalidatePath("/admin/banners");
  return ok({ id: id! });
}
export async function setBannerActive(id: string, active: boolean): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("banners").update({ is_active: active }).eq("id", id);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath("/admin/banners");
  return ok(null);
}
export async function reorderBanners(order: { id: string; sort_order: number }[]): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  for (const o of order) { const { error } = await sb.from("banners").update({ sort_order: o.sort_order }).eq("id", o.id); if (error) return fail(error.message); }
  refreshStorefront(); revalidatePath("/admin/banners");
  return ok(null);
}
export async function deleteBanner(id: string): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { data: b } = await sb.from("banners").select("desktop_image_path, mobile_image_path").eq("id", id).single();
  const { error } = await sb.from("banners").delete().eq("id", id);
  if (error) return fail(error.message);
  const files = [b?.desktop_image_path, b?.mobile_image_path].filter(Boolean) as string[];
  if (files.length) await sb.storage.from("banners").remove(files);
  refreshStorefront(); revalidatePath("/admin/banners");
  return ok(null);
}
