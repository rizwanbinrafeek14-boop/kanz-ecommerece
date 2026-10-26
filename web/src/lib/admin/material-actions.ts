"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";
import type { MaterialReport } from "@/lib/materials/run";

const done = (productId?: string) => { revalidatePath("/admin/materials"); if (productId) revalidatePath(`/admin/products/${productId}`); refreshStorefront(); };
const grades = (g: string[] | string | undefined) => [...new Set((Array.isArray(g) ? g : (g ?? "").split(/[\n,;]+/)).map((x) => x.trim()).filter(Boolean))].slice(0, 60);

/** Automatic detection (dry run = report only). Never changes rows an admin verified, rejected or edited. */
export async function runMaterialDetection(dryRun: boolean): Promise<Result<MaterialReport>> {
  const user = await requireStaff(); const sb = await createClient();
  try {
    const { runDetection } = await import("@/lib/materials/run");
    const rep = await runDetection(sb, { dryRun });
    if (!dryRun) { await audit(sb, user.id, "materials.detect", "product_materials", undefined, { written: rep.written, removed: rep.removed, kept: rep.keptByAdmin }); done(); }
    return ok(rep);
  } catch (e) { return fail(e instanceof Error ? e.message : "Detection failed"); }
}

const setSchema = z.object({ code: z.string().regex(/^[A-Z0-9_]{1,12}$/), grades: z.array(z.string().max(60)).max(60), status: z.enum(["verified", "rejected"]), note: z.string().max(300).nullish() });

/** An admin sets / corrects a material for a manufacturer offering. The row is then protected from automatic detection. */
export async function setProductMaterial(productId: string, input: { code: string; grades: string[] | string; status: "verified" | "rejected"; note?: string | null }): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const p = setSchema.safeParse({ ...input, grades: grades(input.grades) }); if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the material");
  const { data: prev } = await sb.from("product_materials").select("source").eq("product_id", productId).eq("material_code", p.data.code).maybeSingle();
  const { error } = await sb.from("product_materials").upsert({ product_id: productId, material_code: p.data.code, grades: p.data.grades, status: p.data.status, note: p.data.note ?? null,
    source: prev?.source ? (prev.source.startsWith("set by admin") ? prev.source : `${prev.source} → ${p.data.status} by admin`) : "set by admin", edited_by_admin: true, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "product_id,material_code" });
  if (error) return fail(error.message);
  await audit(sb, user.id, `materials.${p.data.status}`, "products", productId, { code: p.data.code, grades: p.data.grades });
  done(productId); return ok(true);
}

export async function removeProductMaterial(productId: string, code: string): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  // keep a rejected marker so the automatic detection does not add it again
  const { error } = await sb.from("product_materials").update({ status: "rejected", edited_by_admin: true, updated_by: user.id, updated_at: new Date().toISOString() }).eq("product_id", productId).eq("material_code", code);
  if (error) return fail(error.message);
  await audit(sb, user.id, "materials.reject", "products", productId, { code }); done(productId); return ok(true);
}

/** Approve the detected materials of several products (auto + unverified rows become verified). */
export async function approveDetected(productIds: string[], codes?: string[]): Promise<Result<{ n: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  if (!productIds.length) return fail("Select at least one product.");
  let q = sb.from("product_materials").update({ status: "verified", edited_by_admin: true, updated_by: user.id, updated_at: new Date().toISOString() }).in("product_id", productIds).in("status", ["auto", "unverified"]);
  if (codes?.length) q = q.in("material_code", codes);
  const { data, error } = await q.select("id"); if (error) return fail(error.message);
  await audit(sb, user.id, "materials.approve", "product_materials", undefined, { products: productIds.length, rows: data?.length ?? 0 }); done(); return ok({ n: data?.length ?? 0 });
}

/** Bulk edit: give several products the same verified material (optionally with grades). Existing grades for that material are kept and merged. */
export async function bulkSetMaterial(productIds: string[], code: string, gradeText: string): Promise<Result<{ n: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  if (!productIds.length) return fail("Select at least one product.");
  if (!/^[A-Z0-9_]{1,12}$/.test(code)) return fail("Choose a material.");
  const g = grades(gradeText);
  const { data: prev } = await sb.from("product_materials").select("product_id, grades, source").eq("material_code", code).in("product_id", productIds);
  const P = new Map((prev ?? []).map((r) => [r.product_id, r]));
  const rows = productIds.map((id) => ({ product_id: id, material_code: code, grades: [...new Set([...(P.get(id)?.grades ?? []), ...g])], status: "verified", edited_by_admin: true, updated_by: user.id, updated_at: new Date().toISOString(),
    source: P.get(id)?.source ? `${P.get(id)!.source} → verified by admin (bulk)` : "set by admin (bulk)" }));
  const { error } = await sb.from("product_materials").upsert(rows, { onConflict: "product_id,material_code" }); if (error) return fail(error.message);
  await audit(sb, user.id, "materials.bulk_set", "product_materials", undefined, { code, products: productIds.length, grades: g }); done(); return ok({ n: rows.length });
}

export async function setVariantMaterial(productId: string, variantId: string, code: string | null): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("product_variants").update({ material_code: code || null }).eq("id", variantId).eq("product_id", productId);
  if (error) return fail(error.message); done(productId); return ok(true);
}

const typeSchema = z.object({ code: z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9_]{1,12}$/, "Code: 1-12 capital letters, digits or _")), name_en: z.string().trim().min(2).max(60), name_ar: z.string().trim().max(60).nullish(), sort_order: z.number().int().min(0).max(9999).default(500) });
export async function saveMaterialType(input: z.input<typeof typeSchema>, isNew: boolean): Promise<Result> {
  const user = await requireAdmin(); const sb = await createClient();
  const p = typeSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form");
  const row = { ...p.data, name_ar: p.data.name_ar || null };
  const { error } = isNew ? await sb.from("material_types").insert({ ...row, is_custom: true }) : await sb.from("material_types").update({ name_en: row.name_en, name_ar: row.name_ar, sort_order: row.sort_order }).eq("code", row.code);
  if (error) return fail(/duplicate/.test(error.message) ? `The code ${row.code} already exists.` : error.message);
  await audit(sb, user.id, isNew ? "materials.type.create" : "materials.type.update", "material_types", undefined, row); done(); return ok(true);
}
export async function deleteMaterialType(code: string): Promise<Result> {
  const user = await requireAdmin(); const sb = await createClient();
  const { count } = await sb.from("product_materials").select("id", { count: "exact", head: true }).eq("material_code", code);
  if (count) return fail(`${count} product material record(s) use ${code}; change them first.`);
  const { error } = await sb.from("material_types").delete().eq("code", code).eq("is_custom", true); if (error) return fail(error.message);
  await audit(sb, user.id, "materials.type.delete", "material_types", undefined, { code }); done(); return ok(true);
}
