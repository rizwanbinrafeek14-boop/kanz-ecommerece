"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, uniqueSlug, type Result } from "./common";
import { slugify } from "@/lib/utils";

const opt = (n: number) => z.string().trim().max(n).nullable();

const categorySchema = z.object({
  name_en: z.string().trim().min(1, "English name is required").max(150), name_ar: opt(150), slug: opt(120), parent_id: z.string().uuid().nullable(),
  description_en: opt(1000), description_ar: opt(1000), image_path: opt(300), sort_order: z.number().int().min(0).max(100000), is_active: z.boolean(), is_featured: z.boolean(),
  seo_title_en: opt(120), seo_title_ar: opt(120), seo_desc_en: opt(300), seo_desc_ar: opt(300),
});
export async function saveCategory(id: string | null, input: z.input<typeof categorySchema>): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const d = parsed.data; const sb = await createClient();
  if (id && d.parent_id === id) return fail("A category cannot be its own parent.");
  if (id && d.parent_id) {   // prevent cycles
    let cur: string | null = d.parent_id; const { data: all } = await sb.from("categories").select("id, parent_id");
    const parentOf = new Map((all ?? []).map((c) => [c.id, c.parent_id])); let guard = 0;
    while (cur && guard++ < 50) { if (cur === id) return fail("That would make the category a child of its own descendant."); cur = parentOf.get(cur) ?? null; }
  }
  const slug = await uniqueSlug(sb, "categories", d.slug ? slugify(d.slug) : d.name_en, id ?? undefined);
  const row = { ...d, slug };
  if (id) { const { error } = await sb.from("categories").update(row).eq("id", id); if (error) return fail(error.message); await audit(sb, user.id, "category.update", "categories", id); refreshStorefront(); revalidatePath("/admin/categories"); return ok({ id }); }
  const { data, error } = await sb.from("categories").insert(row).select("id").single();
  if (error || !data) return fail(error?.message ?? "Could not create category");
  await audit(sb, user.id, "category.create", "categories", data.id); refreshStorefront(); revalidatePath("/admin/categories");
  return ok({ id: data.id });
}
export async function deleteCategory(id: string): Promise<Result> {
  const user = await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) return fail(error.message);
  await audit(sb, user.id, "category.delete", "categories", id); refreshStorefront(); revalidatePath("/admin/categories");
  return ok(null);
}

const brandSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(120), name_ar: opt(120), website: opt(300), logo_path: opt(300), sort_order: z.number().int().min(0).max(100000), is_active: z.boolean(), show_on_homepage: z.boolean() });
export async function saveBrand(id: string | null, input: z.input<typeof brandSchema>): Promise<Result<{ id: string }>> {
  await requireStaff();
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const d = parsed.data; const sb = await createClient();
  if (d.website && !/^https?:\/\//i.test(d.website)) return fail("Website must start with http:// or https://");
  const slug = await uniqueSlug(sb, "brands", d.name, id ?? undefined);
  if (id) { const { error } = await sb.from("brands").update({ ...d, slug }).eq("id", id); if (error) return fail(error.message); }
  else { const { data, error } = await sb.from("brands").insert({ ...d, slug }).select("id").single(); if (error || !data) return fail(error?.message ?? "Could not create brand"); id = data.id; }
  refreshStorefront(); revalidatePath("/admin/brands");
  return ok({ id: id! });
}
export async function deleteBrand(id: string): Promise<Result> {
  await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("brands").delete().eq("id", id);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath("/admin/brands");
  return ok(null);
}

const attrSchema = z.object({ key: z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/, "Key: lowercase letters, numbers and underscores"), name_en: z.string().trim().min(1).max(80), name_ar: opt(80), is_filterable: z.boolean(), show_in_specs: z.boolean(), sort_order: z.number().int().min(0).max(10000) });
export async function saveAttribute(id: string | null, input: z.input<typeof attrSchema>): Promise<Result> {
  await requireStaff();
  const parsed = attrSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const sb = await createClient();
  const q = id ? sb.from("attribute_defs").update(parsed.data).eq("id", id) : sb.from("attribute_defs").insert(parsed.data);
  const { error } = await q;
  if (error) return fail(error.code === "23505" ? "That key already exists." : error.message);
  refreshStorefront(); revalidatePath("/admin/attributes");
  return ok(null);
}
export async function deleteAttribute(id: string): Promise<Result> {
  await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("attribute_defs").delete().eq("id", id);
  if (error) return fail(error.message);
  refreshStorefront(); revalidatePath("/admin/attributes");
  return ok(null);
}
