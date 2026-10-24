"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const opt = (n: number) => z.string().trim().max(n).nullable();
const done = () => { refreshStorefront(); revalidatePath("/admin/content"); };
const linkOk = (v: string | null) => v == null || /^\/(?!\/)/.test(v) || /^https:\/\//i.test(v) || /^(mailto:|tel:)/i.test(v);

const secSchema = z.object({ title_en: opt(120), title_ar: opt(120), subtitle_en: opt(300), subtitle_ar: opt(300), is_enabled: z.boolean(), sort_order: z.number().int().min(0).max(10000), limit: z.number().int().min(1).max(24).optional() });
export async function saveHomepageSection(id: string, input: z.input<typeof secSchema>): Promise<Result> {
  await requireStaff();
  const p = secSchema.safeParse(input); if (!p.success) return fail("Please check the section fields.");
  const sb = await createClient(); const { limit, ...rest } = p.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (limit) { const { data } = await sb.from("homepage_sections").select("config").eq("id", id).single(); patch.config = { ...((data?.config as object) ?? {}), limit }; }
  const { error } = await sb.from("homepage_sections").update(patch).eq("id", id);
  if (error) return fail(error.message); done(); return ok(null);
}
export async function reorderSections(order: { id: string; sort_order: number }[]): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  for (const o of order) { const { error } = await sb.from("homepage_sections").update({ sort_order: o.sort_order }).eq("id", o.id); if (error) return fail(error.message); }
  done(); return ok(null);
}

const annSchema = z.object({ text_en: z.string().trim().min(1, "Announcement text is required").max(200), text_ar: opt(200), link_url: opt(500).refine(linkOk, "Link must start with /, https://, mailto: or tel:"), starts_at: z.string().nullable(), ends_at: z.string().nullable(), is_active: z.boolean(), sort_order: z.number().int().min(0).max(1000) });
export async function saveAnnouncement(id: string | null, input: z.input<typeof annSchema>): Promise<Result> {
  await requireStaff(); const p = annSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const sb = await createClient(); const { error } = id ? await sb.from("announcements").update(p.data).eq("id", id) : await sb.from("announcements").insert(p.data);
  if (error) return fail(error.message); done(); return ok(null);
}
export async function deleteAnnouncement(id: string): Promise<Result> { await requireStaff(); const sb = await createClient(); const { error } = await sb.from("announcements").delete().eq("id", id); if (error) return fail(error.message); done(); return ok(null); }

const linkSchema = z.object({ menu: z.enum(["header", "footer_company", "footer_products", "footer_support", "footer_legal"]), label_en: z.string().trim().min(1, "Label is required").max(80), label_ar: opt(80), url: z.string().trim().min(1, "URL is required").max(500).refine((v) => linkOk(v), "URL must start with /, https://, mailto: or tel:"), sort_order: z.number().int().min(0).max(1000), is_active: z.boolean() });
export async function saveMenuLink(id: string | null, input: z.input<typeof linkSchema>): Promise<Result> {
  await requireStaff(); const p = linkSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const sb = await createClient(); const { error } = id ? await sb.from("menu_links").update(p.data).eq("id", id) : await sb.from("menu_links").insert(p.data);
  if (error) return fail(error.message); done(); return ok(null);
}
export async function deleteMenuLink(id: string): Promise<Result> { await requireStaff(); const sb = await createClient(); const { error } = await sb.from("menu_links").delete().eq("id", id); if (error) return fail(error.message); done(); return ok(null); }

// Only whitelisted keys can be written; every key is stored under the public. prefix (readable by the storefront).
const KEYS = ["company_name_en", "company_name_ar", "company_tagline_en", "company_about_en", "company_phone", "company_whatsapp", "company_email_sales", "company_email_info", "company_address_en", "company_website", "vat_number", "company_cr_number", "seo_default_title", "seo_default_description"] as const;
const settingsSchema = z.object({
  vat_rate: z.number().min(0).max(100), values: z.partialRecord(z.enum(KEYS), z.string().trim().max(1000)),
  delivery: z.object({ delivery: z.boolean(), pickup: z.boolean() }).refine((d) => d.delivery || d.pickup, "Enable at least one delivery option"),
  payments: z.object({ bank_transfer: z.boolean(), cod: z.boolean() }).refine((d) => d.bank_transfer || d.cod, "Enable at least one payment method"),
});
export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const user = await requireAdmin();
  const p = settingsSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the settings.");
  const d = p.data;
  if (d.values.company_whatsapp && !/^\d{8,15}$/.test(d.values.company_whatsapp)) return fail("WhatsApp number: digits only with country code, e.g. 966507264938");
  if (d.values.vat_number && !/^3\d{14}$/.test(d.values.vat_number)) return fail("A Saudi VAT registration number has 15 digits and starts with 3. Leave it blank until you have it.");
  const sb = await createClient();
  const rows = [
    { key: "public.vat_rate", value: d.vat_rate }, { key: "public.delivery_options", value: d.delivery }, { key: "public.payment_methods", value: { ...d.payments, card: false, mada: false, apple_pay: false, stc_pay: false } },
    ...Object.entries(d.values).map(([k, v]) => ({ key: `public.${k}`, value: v })),
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await sb.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) return fail(error.message);
  await audit(sb, user.id, "settings.update", "site_settings", undefined, { vat_rate: d.vat_rate });
  done(); return ok(null);
}
