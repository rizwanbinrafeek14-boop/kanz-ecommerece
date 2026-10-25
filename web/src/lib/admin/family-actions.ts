"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const done = (id?: string) => { revalidatePath("/admin/families"); if (id) revalidatePath(`/admin/families/${id}`); refreshStorefront(); };
const nn = (s: string | null | undefined) => { const t = (s ?? "").trim(); return t === "" ? null : t; };

const familySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, "Address: 2-80 lowercase letters, digits and dashes"),
  name_en: z.string().trim().min(2).max(160), name_ar: z.string().trim().max(160).nullish(),
  product_type: z.string().trim().max(60).nullish(), category_id: z.string().uuid().nullish(),
  short_desc_en: z.string().trim().max(500).nullish(), short_desc_ar: z.string().trim().max(500).nullish(),
  description_en: z.string().trim().max(8000).nullish(), description_ar: z.string().trim().max(8000).nullish(),
  image_path: z.string().trim().max(300).regex(/^families\//, "Upload the photo with the button").nullish(),
  seo_title_en: z.string().trim().max(70).nullish(), seo_title_ar: z.string().trim().max(70).nullish(),
  seo_desc_en: z.string().trim().max(170).nullish(), seo_desc_ar: z.string().trim().max(170).nullish(), seo_noindex: z.boolean().default(false),
  status: z.enum(["draft", "published"]),
});
export type FamilyInput = z.input<typeof familySchema>;

export async function saveFamily(id: string | null, input: FamilyInput): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const blankToNull = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));
  const p = familySchema.safeParse(blankToNull); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const sb = await createClient();
  const row = { slug: d.slug, name_en: d.name_en, name_ar: nn(d.name_ar), product_type: nn(d.product_type), category_id: d.category_id ?? null, short_desc_en: nn(d.short_desc_en), short_desc_ar: nn(d.short_desc_ar),
    description_en: nn(d.description_en), description_ar: nn(d.description_ar), image_path: nn(d.image_path), seo_title_en: nn(d.seo_title_en), seo_title_ar: nn(d.seo_title_ar), seo_desc_en: nn(d.seo_desc_en), seo_desc_ar: nn(d.seo_desc_ar),
    seo_noindex: d.seo_noindex, status: d.status };
  if (d.status === "published") {
    const { count } = id ? await sb.from("products").select("id", { count: "exact", head: true }).eq("family_id", id).eq("family_link", "confirmed").eq("status", "published") : { count: 0 };
    if (!count) return fail("Confirm at least one published manufacturer offering before publishing the family page.");
  }
  const res = id
    ? await sb.from("product_families").update({ ...row, published_at: d.status === "published" ? new Date().toISOString() : null }).eq("id", id).select("id").single()
    : await sb.from("product_families").insert(row).select("id").single();
  if (res.error) return fail(/already used|duplicate/.test(res.error.message) ? `The address "${d.slug}" is already used by another product or family.` : res.error.message);
  await audit(sb, user.id, id ? "family.update" : "family.create", "product_families", res.data.id, { slug: d.slug, status: d.status });
  done(res.data.id); return ok({ id: res.data.id });
}

export async function deleteFamily(id: string): Promise<Result> {
  const user = await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("product_families").delete().eq("id", id);   // offerings stay as normal products (family_id is cleared)
  if (error) return fail(error.message);
  await sb.from("products").update({ family_link: "suggested" }).is("family_id", null).eq("family_link", "confirmed");
  await audit(sb, user.id, "family.delete", "product_families", id); done(); return ok(true);
}

/** Confirm / reject / reset a manufacturer offering on its family page. Never changes the offering's own data. */
export async function setOfferingLink(productId: string, link: "confirmed" | "rejected" | "suggested"): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: p, error } = await sb.from("products").update({ family_link: link }).eq("id", productId).not("family_id", "is", null).select("id, family_id, slug").single();
  if (error || !p) return fail(error?.message ?? "This product is not in a family.");
  await sb.from("family_link_suggestions").update({ status: link === "confirmed" ? "approved" : link === "rejected" ? "rejected" : "pending", decided_by: link === "suggested" ? null : user.id, decided_at: link === "suggested" ? null : new Date().toISOString() })
    .eq("product_id", productId).eq("family_id", p.family_id);
  await audit(sb, user.id, `family.offering.${link}`, "products", productId, { family_id: p.family_id });
  done(p.family_id); return ok(true);
}

export async function moveOffering(productId: string, dir: -1 | 1): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { data: p } = await sb.from("products").select("id, family_id").eq("id", productId).single();
  if (!p?.family_id) return fail("Not in a family.");
  const { data: list } = await sb.from("products").select("id, family_sort, name_en").eq("family_id", p.family_id).order("family_sort").order("name_en");
  const ids = (list ?? []).map((x) => x.id); const i = ids.indexOf(productId); const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ok(true);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((id, n) => sb.from("products").update({ family_sort: n }).eq("id", id)));
  done(p.family_id); return ok(true);
}

/** Put an existing product into this family (confirmed straight away, because an admin chose it). */
export async function linkProduct(familyId: string, productId: string): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: prev } = await sb.from("products").select("family_id").eq("id", productId).single();
  const { error } = await sb.from("products").update({ family_id: familyId, family_link: "confirmed" }).eq("id", productId);
  if (error) return fail(error.message);
  await sb.from("family_link_suggestions").upsert({ product_id: productId, family_id: familyId, confidence: "exact", reasons: ["Linked manually by an administrator."], status: "approved", decided_by: user.id, decided_at: new Date().toISOString() }, { onConflict: "product_id,family_id" });
  await audit(sb, user.id, "family.offering.link", "products", productId, { family_id: familyId, previous_family: prev?.family_id ?? null });
  done(familyId); if (prev?.family_id && prev.family_id !== familyId) revalidatePath(`/admin/families/${prev.family_id}`); return ok(true);
}

export async function unlinkProduct(productId: string): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const { data: p } = await sb.from("products").select("family_id").eq("id", productId).single();
  const { error } = await sb.from("products").update({ family_id: null, family_link: "suggested", family_sort: 0 }).eq("id", productId);
  if (error) return fail(error.message);
  await audit(sb, user.id, "family.offering.unlink", "products", productId, { family_id: p?.family_id ?? null });
  done(p?.family_id ?? undefined); return ok(true);
}


/**
 * Automatic grouping (owner's rule): only EXACT matches are linked; likely/uncertain ones stay waiting for a decision.
 * Families that then have two or more confirmed, published offerings are published, so the shop shows one card for them.
 * With dryRun the same plan is returned without changing anything.
 */
export async function applyAutoGrouping(dryRun: boolean): Promise<Result<{ confirm: { product: string; family: string }[]; publish: string[] }>> {
  const user = await requireStaff(); const sb = await createClient();
  const { scanSuggestions } = await import("@/lib/families/scan");
  await scanSuggestions(sb);
  const [{ data: sugg }, { data: prods }, { data: fams }] = await Promise.all([
    sb.from("family_link_suggestions").select("product_id, family_id").eq("status", "pending").eq("confidence", "exact"),
    sb.from("products").select("id, name_en, family_id, family_link, status").not("family_id", "is", null),
    sb.from("product_families").select("id, name_en, status"),
  ]);
  const P = new Map((prods ?? []).map((p) => [p.id, p])); const F = new Map((fams ?? []).map((f) => [f.id, f]));
  const size = new Map<string, number>(); for (const p of prods ?? []) size.set(p.family_id!, (size.get(p.family_id!) ?? 0) + 1);
  // a lone product's "exact" suggestion only means it is the first in its family: grouping needs at least two manufacturers
  const cand = (sugg ?? []).filter((s) => (size.get(s.family_id) ?? 0) > 1 && P.get(s.product_id)?.family_link === "suggested");
  // only link when at least two manufacturers end up together (already confirmed + exact matches)
  const together = new Map<string, number>();
  for (const p of prods ?? []) if (p.family_link === "confirmed") together.set(p.family_id!, (together.get(p.family_id!) ?? 0) + 1);
  for (const c of cand) together.set(c.family_id, (together.get(c.family_id) ?? 0) + 1);
  const confirm = cand.filter((c) => (together.get(c.family_id) ?? 0) >= 2);
  const linked = new Map<string, number>();
  for (const p of prods ?? []) if (p.status === "published" && (p.family_link === "confirmed" || confirm.some((c) => c.product_id === p.id))) linked.set(p.family_id!, (linked.get(p.family_id!) ?? 0) + 1);
  const publish = [...linked].filter(([fid, n]) => n >= 2 && F.get(fid)?.status !== "published").map(([fid]) => fid);
  const plan = { confirm: confirm.map((c) => ({ product: P.get(c.product_id)?.name_en ?? c.product_id, family: F.get(c.family_id)?.name_en ?? c.family_id })), publish: publish.map((id) => F.get(id)?.name_en ?? id) };
  if (dryRun) return ok(plan);
  const now = new Date().toISOString();
  for (const c of confirm) {
    await sb.from("products").update({ family_link: "confirmed" }).eq("id", c.product_id).eq("family_link", "suggested");
    await sb.from("family_link_suggestions").update({ status: "approved", decided_by: user.id, decided_at: now }).eq("product_id", c.product_id).eq("family_id", c.family_id);
  }
  if (publish.length) await sb.from("product_families").update({ status: "published", published_at: now }).in("id", publish);
  await audit(sb, user.id, "family.auto_group", "product_families", undefined, { confirmed: confirm.length, published: publish.length });
  done(); return ok(plan);
}
