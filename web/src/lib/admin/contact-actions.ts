"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanIconUpload } from "@/lib/icons";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const done = () => { refreshStorefront(); revalidatePath("/admin/social"); };
type SB = Awaited<ReturnType<typeof createClient>>;

/** Validates the uploaded icon by content, stores the sanitised bytes in the public site-icons bucket and returns the object path. */
async function storeIcon(sb: SB, file: File, folder: string): Promise<string> {
  const clean = cleanIconUpload(Buffer.from(await file.arrayBuffer()));
  const path = `${folder}/${randomUUID()}.${clean.ext}`;
  const { error } = await sb.storage.from("site-icons").upload(path, clean.bytes, { contentType: clean.contentType, upsert: false });
  if (error) throw new Error(`Could not store the icon: ${error.message}`);
  return path;
}
const dropIcon = async (sb: SB, path: string | null | undefined) => { if (path) await sb.storage.from("site-icons").remove([path]); };
const fileOf = (fd: FormData) => { const f = fd.get("icon"); return f instanceof File && f.size > 0 ? f : null; };
const dataOf = (fd: FormData): unknown => { try { return JSON.parse(String(fd.get("data") ?? "{}")); } catch { return {}; } };

/** "+966 50 726 4938" / "00966507264938" -> "966507264938" (international format, digits only, no leading 0). */
export async function normalizeWhatsApp(raw: string): Promise<string | null> {
  const d = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "").replace(/^00/, "");
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

const widgetSchema = z.object({
  whatsapp_enabled: z.boolean(), whatsapp_number: z.string().trim().max(30), position: z.enum(["left", "right"]), show_desktop: z.boolean(), show_mobile: z.boolean(),
  default_message_en: z.string().trim().min(1, "Default message (English) is required").max(500), default_message_ar: z.string().trim().min(1, "Default message (Arabic) is required").max(500),
  label_en: z.string().trim().min(1).max(60), label_ar: z.string().trim().min(1).max(60), description_en: z.string().trim().min(1).max(160), description_ar: z.string().trim().min(1).max(160),
  menu_label_en: z.string().trim().min(1).max(40), menu_label_ar: z.string().trim().min(1).max(40), show_call: z.boolean(), call_number: z.string().trim().max(30), removeIcon: z.boolean().optional(),
});
export async function saveContactWidget(fd: FormData): Promise<Result> {
  const user = await requireStaff();
  const p = widgetSchema.safeParse(dataOf(fd));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const sb = await createClient();
  let number = "";
  if (d.whatsapp_number) { const n = await normalizeWhatsApp(d.whatsapp_number); if (!n) return fail("WhatsApp number must be in international format, e.g. +966 50 726 4938 (country code, no leading 0)."); number = n; }
  if (d.whatsapp_enabled && !number) return fail("Enter the WhatsApp number before enabling the button (or turn the button off).");
  const call = d.call_number.replace(/[\s\-().]/g, "");
  if (call && !/^\+?\d{6,16}$/.test(call)) return fail("Call number must contain digits only (optionally starting with +).");
  const { data: cur } = await sb.from("contact_widget").select("icon_path").eq("id", 1).single();
  let icon_path: string | null | undefined = undefined;
  try {
    const f = fileOf(fd);
    if (f) { icon_path = await storeIcon(sb, f, "whatsapp"); await dropIcon(sb, cur?.icon_path); }
    else if (d.removeIcon) { icon_path = null; await dropIcon(sb, cur?.icon_path); }
  } catch (e) { return fail((e as Error).message); }
  const { removeIcon: _r, ...rest } = d; void _r;
  const { error } = await sb.from("contact_widget").update({ ...rest, whatsapp_number: number, call_number: call, ...(icon_path !== undefined ? { icon_path } : {}), updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return fail(error.message);
  await audit(sb, user.id, "contact_widget.update", "contact_widget", "1");
  done(); return ok(null);
}

const HOSTS: Record<string, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i, facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, linkedin: /(^|\.)linkedin\.com$/i, x: /(^|\.)(x\.com|twitter\.com)$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i, tiktok: /(^|\.)tiktok\.com$/i, snapchat: /(^|\.)snapchat\.com$/i,
};
const PLATFORMS = ["instagram", "facebook", "linkedin", "x", "youtube", "tiktok", "snapchat", "custom"] as const;
const linkSchema = z.object({
  id: z.string().uuid().nullable(), platform: z.enum(PLATFORMS), name: z.string().trim().min(1, "Platform name is required").max(60), url: z.string().trim().min(1, "Profile URL is required").max(500),
  accessible_label: z.string().trim().max(120), is_active: z.boolean(), show_header: z.boolean(), show_footer: z.boolean(), show_mobile_menu: z.boolean(), show_floating: z.boolean(),
  use_builtin: z.boolean(), removeIcon: z.boolean().optional(),
});
export async function validateSocialUrl(platform: string, raw: string): Promise<string> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Profile URL is not a valid web address. Start it with https://"); }
  if (u.protocol !== "https:") throw new Error("Profile URL must start with https:// (insecure http:// and other schemes are not allowed).");
  if (u.username || u.password) throw new Error("Profile URL must not contain a username or password.");
  const h = u.hostname;
  if (!h.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === "localhost" || h.endsWith(".local") || h.startsWith("[")) throw new Error("Profile URL must be a public website address.");
  const re = HOSTS[platform];
  if (re && !re.test(h)) throw new Error(`This does not look like a ${platform === "x" ? "X (Twitter)" : platform[0].toUpperCase() + platform.slice(1)} link (expected the address to be on that platform). Choose “Custom” for other websites.`);
  return u.toString();
}

export async function saveSocialLink(fd: FormData): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const p = linkSchema.safeParse(dataOf(fd));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const sb = await createClient();
  let url: string; try { url = await validateSocialUrl(d.platform, d.url); } catch (e) { return fail((e as Error).message); }
  const label = d.accessible_label || `${d.name} (opens in a new tab)`;
  const file = d.use_builtin ? null : fileOf(fd);
  let cur: { icon_path: string | null } | null = null;
  if (d.id) { const r = await sb.from("social_links").select("icon_path").eq("id", d.id).single(); cur = r.data; }
  let icon_path: string | null | undefined = undefined;
  try {
    if (d.use_builtin || d.removeIcon) { icon_path = null; await dropIcon(sb, cur?.icon_path); }
    if (file) { icon_path = await storeIcon(sb, file, "social"); if (!d.use_builtin) await dropIcon(sb, cur?.icon_path); }
  } catch (e) { return fail((e as Error).message); }
  if (d.platform === "custom" && !d.use_builtin && !file && !(cur?.icon_path && !d.removeIcon)) { /* custom without upload falls back to the generic globe icon */ }
  const row = { platform: d.platform, name: d.name, url, accessible_label: label, is_active: d.is_active, show_header: d.show_header, show_footer: d.show_footer, show_mobile_menu: d.show_mobile_menu, show_floating: d.show_floating, ...(icon_path !== undefined ? { icon_path } : {}) };
  let id = d.id;
  if (id) { const { error } = await sb.from("social_links").update(row).eq("id", id); if (error) return fail(error.message); }
  else {
    const { data: last } = await sb.from("social_links").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const { data, error } = await sb.from("social_links").insert({ ...row, sort_order: (last?.[0]?.sort_order ?? 0) + 10 }).select("id").single();
    if (error || !data) return fail(error?.message ?? "Could not save the link."); id = data.id;
  }
  await audit(sb, user.id, d.id ? "social.update" : "social.create", "social_links", id!);
  done(); return ok({ id: id! });
}
export async function deleteSocialLink(id: string): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { data: cur } = await sb.from("social_links").select("icon_path").eq("id", id).maybeSingle();
  const { error } = await sb.from("social_links").delete().eq("id", id);
  if (error) return fail(error.message);
  await dropIcon(sb, cur?.icon_path); done(); return ok(null);
}
export async function reorderSocialLinks(order: { id: string; sort_order: number }[]): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  for (const o of order) { const { error } = await sb.from("social_links").update({ sort_order: o.sort_order }).eq("id", o.id); if (error) return fail(error.message); }
  done(); return ok(null);
}
export async function setSocialActive(id: string, active: boolean): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("social_links").update({ is_active: active }).eq("id", id);
  if (error) return fail(error.message); done(); return ok(null);
}
