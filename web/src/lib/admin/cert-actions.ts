"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanIconUpload } from "@/lib/icons";
import { httpsUrl } from "@/lib/url-check";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const done = () => { refreshStorefront(); revalidatePath("/admin/certifications"); revalidatePath("/quality"); };
const dataOf = (fd: FormData): unknown => { try { return JSON.parse(String(fd.get("data") ?? "{}")); } catch { return {}; } };
const nn = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must look like 2027-03-31").refine((d) => !Number.isNaN(Date.parse(d)), "Not a valid date").nullable();
/** Certificate PDFs are uploaded by the browser to product-docs/certificates/…; only that exact shape is accepted here. */
const pdfPath = z.string().regex(/^certificates\/[A-Za-z0-9._-]{1,150}\.pdf$/i, "Certificate documents must be PDF files").nullable();
const optUrl = (v: string | null, what: string) => (nn(v) ? httpsUrl(v!, what) : null);

const certSchema = z.object({
  id: z.string().uuid().nullable(), name_en: z.string().trim().min(2, "Certification name is required").max(150), name_ar: z.string().trim().max(150).nullable(),
  description_en: z.string().trim().max(1000).nullable(), description_ar: z.string().trim().max(1000).nullable(),
  issuer: z.string().trim().max(150).nullable(), reference_number: z.string().trim().max(100).nullable(), holder: z.string().trim().max(150).nullable(),
  scope: z.enum(["company", "manufacturer", "product"]), issued_at: isoDate, valid_until: isoDate, document_path: pdfPath, verification_url: z.string().trim().max(500).nullable(),
  show_on_quality: z.boolean(), is_active: z.boolean(), removeLogo: z.boolean().optional(),
});

export async function saveCertification(fd: FormData): Promise<Result<{ id: string }>> {
  const user = await requireAdmin();
  const p = certSchema.safeParse(dataOf(fd)); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const sb = await createClient();
  if (d.issued_at && d.valid_until && d.valid_until < d.issued_at) return fail("The expiry date is before the issue date.");
  let verification_url: string | null; try { verification_url = optUrl(d.verification_url, "Verification URL"); } catch (e) { return fail((e as Error).message); }
  let cur: { logo_path: string | null } | null = null;
  if (d.id) { const r = await sb.from("certifications").select("logo_path").eq("id", d.id).maybeSingle(); cur = r.data; if (!r.data) return fail("Certification not found."); }
  let logo_path: string | null | undefined;
  const file = fd.get("logo");
  if (file instanceof File && file.size > 0) {
    try {
      const clean = cleanIconUpload(Buffer.from(await file.arrayBuffer()));
      const path = `certs/${randomUUID()}.${clean.ext}`;
      const { error } = await sb.storage.from("site-icons").upload(path, clean.bytes, { contentType: clean.contentType, upsert: false });
      if (error) return fail(`Could not store the logo: ${error.message}`);
      logo_path = path;
    } catch (e) { return fail((e as Error).message); }
  } else if (d.removeLogo) logo_path = null;
  const row = { name_en: d.name_en, name_ar: nn(d.name_ar), description_en: nn(d.description_en), description_ar: nn(d.description_ar), issuer: nn(d.issuer), reference_number: nn(d.reference_number), holder: nn(d.holder),
    scope: d.scope, issued_at: d.issued_at, valid_until: d.valid_until, document_path: d.document_path, verification_url, show_on_quality: d.show_on_quality, is_active: d.is_active, ...(logo_path !== undefined ? { logo_path } : {}) };
  let id = d.id;
  if (id) { const { error } = await sb.from("certifications").update(row).eq("id", id); if (error) return fail(error.message); }
  else {
    const { data: last } = await sb.from("certifications").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const { data, error } = await sb.from("certifications").insert({ ...row, sort_order: (last?.[0]?.sort_order ?? 0) + 10 }).select("id").single();
    if (error || !data) return fail(error?.message ?? "Could not save."); id = data.id;
  }
  if (logo_path !== undefined && cur?.logo_path) await sb.storage.from("site-icons").remove([cur.logo_path]);
  await audit(sb, user.id, d.id ? "certification.update" : "certification.create", "certifications", id!);
  done(); return ok({ id: id! });
}

export async function setCertificationPublished(id: string, published: boolean): Promise<Result> {
  const user = await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("certifications").update({ is_active: published }).eq("id", id);
  if (error) return fail(error.message);
  await audit(sb, user.id, published ? "certification.publish" : "certification.unpublish", "certifications", id); done(); return ok(null);
}
export async function reorderCertifications(order: { id: string; sort_order: number }[]): Promise<Result> {
  await requireAdmin(); const sb = await createClient();
  for (const o of order) { const { error } = await sb.from("certifications").update({ sort_order: o.sort_order }).eq("id", o.id); if (error) return fail(error.message); }
  done(); return ok(null);
}
/** Deleting a certification also removes it from every product it was assigned to (the admin screen shows the count first). */
export async function deleteCertification(id: string): Promise<Result<{ removedFromProducts: number }>> {
  const user = await requireAdmin(); const sb = await createClient();
  const { data: cur } = await sb.from("certifications").select("logo_path, name_en").eq("id", id).maybeSingle();
  const { count } = await sb.from("product_certifications").select("product_id", { count: "exact", head: true }).eq("certification_id", id);
  const { error } = await sb.from("certifications").delete().eq("id", id);
  if (error) return fail(error.message);
  if (cur?.logo_path) await sb.storage.from("site-icons").remove([cur.logo_path]);
  await audit(sb, user.id, "certification.delete", "certifications", id, { name: cur?.name_en, removedFromProducts: count ?? 0 });
  done(); return ok({ removedFromProducts: count ?? 0 });
}

const assignSchema = z.array(z.object({
  certification_id: z.string().uuid(), status: z.enum(["verified", "pending", "not_available", "not_applicable"]),
  reference_number: z.string().trim().max(100).nullable(), document_path: pdfPath, verification_url: z.string().trim().max(500).nullable(),
  scope_note: z.string().trim().max(300).nullable(), variant_ids: z.array(z.string().uuid()).max(500),
})).max(50);
export type Assignment = z.input<typeof assignSchema>[number];

export async function setProductCertifications(productId: string, input: Assignment[]): Promise<Result> {
  const user = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return fail("Unknown product.");
  const p = assignSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the approvals.");
  const sb = await createClient();
  const ids = p.data.map((a) => a.certification_id);
  if (new Set(ids).size !== ids.length) return fail("The same certification is listed twice.");
  const { data: vs } = await sb.from("product_variants").select("id").eq("product_id", productId);
  const valid = new Set((vs ?? []).map((v) => v.id));
  let rows;
  try {
    rows = p.data.map((a) => {
      if (a.variant_ids.some((v) => !valid.has(v))) throw new Error("A selected variant does not belong to this product.");
      return { product_id: productId, certification_id: a.certification_id, status: a.status, reference_number: nn(a.reference_number), document_path: a.document_path, verification_url: optUrl(a.verification_url, "Verification URL"), scope_note: nn(a.scope_note), variant_ids: a.variant_ids, updated_at: new Date().toISOString() };
    });
  } catch (e) { return fail((e as Error).message); }
  // Replace the set: remove what is no longer selected, upsert the rest (keeps the operation consistent if one row is rejected).
  const keep = rows.map((r) => r.certification_id);
  const del = sb.from("product_certifications").delete().eq("product_id", productId);
  const { error: e1 } = keep.length ? await del.not("certification_id", "in", `(${keep.join(",")})`) : await del;
  if (e1) return fail(e1.message);
  if (rows.length) { const { error } = await sb.from("product_certifications").upsert(rows, { onConflict: "product_id,certification_id" }); if (error) return fail(error.message); }
  await audit(sb, user.id, "product.certifications", "products", productId, { count: rows.length });
  refreshStorefront(); revalidatePath(`/admin/products/${productId}`); return ok(null);
}

const textSchema = z.object({ intro_en: z.string().trim().max(3000), intro_ar: z.string().trim().max(3000), banner_en: z.string().trim().max(150), banner_ar: z.string().trim().max(150) });
export async function saveQualityText(input: z.input<typeof textSchema>): Promise<Result> {
  const user = await requireAdmin(); const p = textSchema.safeParse(input); if (!p.success) return fail("Please check the text (too long?).");
  const sb = await createClient(); const now = new Date().toISOString();
  const rows = (["intro_en", "intro_ar", "banner_en", "banner_ar"] as const).map((k) => ({ key: `public.quality_${k}`, value: p.data[k], updated_at: now }));
  const { error } = await sb.from("site_settings").upsert(rows, { onConflict: "key" }); if (error) return fail(error.message);
  await audit(sb, user.id, "quality.text", "site_settings"); done(); return ok(null);
}
