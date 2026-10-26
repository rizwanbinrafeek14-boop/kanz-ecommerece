"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, refreshStorefront, type Result } from "./common";

const done = (id: string) => { revalidatePath(`/admin/products/${id}`); refreshStorefront(); };
const keyRe = /^[a-z][a-z0-9_]{0,30}$/;
const reqMap = z.record(z.string().regex(keyRe), z.array(z.string().max(80)).max(60));
const choiceSchema = z.object({
  key: z.string().regex(keyRe), name_en: z.string().trim().min(1).max(80), name_ar: z.string().trim().max(80).nullish(), type: z.enum(["select", "number", "text"]), required: z.boolean().optional(),
  values: z.array(z.object({ value: z.string().trim().min(1).max(80), label_en: z.string().trim().min(1).max(120), label_ar: z.string().trim().max(120).nullish(), material: z.string().regex(/^[A-Z0-9_]{1,12}$/).optional(), requires: reqMap.optional(), hint_en: z.string().max(200).optional() })).max(60).optional(),
  requires: reqMap.optional(), requires_choice: reqMap.optional(), hint_en: z.string().max(200).optional(), hint_ar: z.string().max(200).optional(),
  min: z.number().optional(), max: z.number().optional(), step: z.number().positive().optional(), unit: z.string().max(20).optional(), maxlength: z.number().int().min(1).max(500).optional(),
}).refine((c) => c.type !== "select" || (c.values?.length ?? 0) > 0, "A list choice needs values");
const propSchema = z.object({ label_en: z.string().trim().min(1).max(120), label_ar: z.string().trim().max(120).nullish(), value_en: z.string().trim().min(1).max(400), value_ar: z.string().trim().max(400).nullish() });

/** Configuration choices and extra specification rows (stored in products.specs, next to standards / notes). */
const overviewSchema = z.object({ seals_en: z.string().trim().max(600).nullish(), seals_ar: z.string().trim().max(600).nullish(), confirm_en: z.array(z.string().trim().min(1).max(200)).max(15), confirm_ar: z.array(z.string().trim().min(1).max(200)).max(15) });
const visualSchema = z.object({ type: z.enum(["spiral-wound-gasket"]).nullable(), enable_3d: z.boolean() });

export async function saveTechSpecs(productId: string, input: { choices: unknown; properties: unknown; notes: string[]; standards: { code: string; note?: string | null }[]; overview?: unknown; visual?: unknown }): Promise<Result> {
  const user = await requireStaff(); const sb = await createClient();
  const c = z.array(choiceSchema).max(30).safeParse(input.choices); if (!c.success) return fail(`Configuration choices: ${c.error.issues[0]?.path.join(".")} ${c.error.issues[0]?.message}`);
  if (new Set(c.data.map((x) => x.key)).size !== c.data.length) return fail("Configuration choices: every key must be unique.");
  const pr = z.array(propSchema).max(40).safeParse(input.properties); if (!pr.success) return fail(`Specification rows: ${pr.error.issues[0]?.path.join(".")} ${pr.error.issues[0]?.message}`);
  const ov = overviewSchema.safeParse(input.overview ?? { confirm_en: [], confirm_ar: [] }); if (!ov.success) return fail(`Overview: ${ov.error.issues[0]?.path.join(".")} ${ov.error.issues[0]?.message}`);
  const vi = visualSchema.safeParse(input.visual ?? { type: null, enable_3d: false }); if (!vi.success) return fail("Visual: choose a supported visual type.");
  const { data: p } = await sb.from("products").select("specs").eq("id", productId).single();
  const specs = { ...(p?.specs ?? {}), choices: c.data, properties: pr.data, notes: input.notes.map((x) => x.trim()).filter(Boolean).slice(0, 40),
    standards: input.standards.filter((x) => x.code.trim()).slice(0, 30).map((x) => ({ code: x.code.trim().slice(0, 60), scope: "product", note: x.note?.trim() || null })),
    overview: { seals_en: ov.data.seals_en || null, seals_ar: ov.data.seals_ar || null, confirm_en: ov.data.confirm_en, confirm_ar: ov.data.confirm_ar },
    visual: { type: vi.data.type, enable_3d: vi.data.type ? vi.data.enable_3d : false } };
  const { error } = await sb.from("products").update({ specs, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) return fail(error.message);
  await audit(sb, user.id, "product.techdata", "products", productId, { choices: c.data.length, properties: pr.data.length }); done(productId); return ok(true);
}

/**
 * One dimension table, edited as tab- (or ;-) separated text. First line = headers: the option keys that pick the row (e.g. style, size, class),
 * then the column keys. A cell left empty or "–" is "not listed". Column labels / units are kept from the existing table where the key is unchanged.
 */
export async function saveDimensionTable(productId: string, tableId: string, input: { title_en: string; title_ar: string | null; notes: string[]; applies: Record<string, string>; matchKeys: string[]; text: string }): Promise<Result<{ rows: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  if (!input.title_en.trim()) return fail("Title is required.");
  const { data: t } = await sb.from("dimension_tables").select("id, columns, product_id").eq("id", tableId).eq("product_id", productId).single();
  if (!t) return fail("Table not found.");
  const lines = input.text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  if (lines.length < 2) return fail("Paste a header line and at least one row.");
  const split = (l: string) => (l.includes("\t") ? l.split("\t") : l.split(";")).map((x) => x.trim());
  const head = split(lines[0]); const mk = input.matchKeys.filter(Boolean);
  if (!mk.every((k, i) => head[i] === k)) return fail(`The first header cells must be the selection keys: ${mk.join(", ")}`);
  const colKeys = head.slice(mk.length); if (!colKeys.length || colKeys.some((k) => !/^[a-z0-9_]{1,20}$/.test(k))) return fail("Column keys: lowercase letters, digits and _ only.");
  const old = new Map(((t.columns ?? []) as { key: string }[]).map((c) => [c.key, c]));
  const columns = colKeys.map((k) => old.get(k) ?? { key: k, symbol: k, label_en: k, unit: "mm" });
  const rows = lines.slice(1).map((l, i) => { const c = split(l); if (c.length > head.length) throw new Error(`Row ${i + 2} has more cells than the header.`);
    return { match: Object.fromEntries(mk.map((k, j) => [k, c[j] ?? ""])), values: Object.fromEntries(colKeys.map((k, j) => [k, c[mk.length + j] ?? ""]).filter(([, v]) => v && v !== "–" && v !== "-")) }; });
  if (rows.some((r) => Object.values(r.match).some((v) => !v))) return fail("Every row needs a value for each selection key.");
  const { error } = await sb.from("dimension_tables").update({ title_en: input.title_en.trim(), title_ar: input.title_ar?.trim() || null, notes: input.notes.map((x) => x.trim()).filter(Boolean), applies: input.applies, columns }).eq("id", tableId);
  if (error) return fail(error.message);
  await sb.from("dimension_rows").delete().eq("table_id", tableId);
  const ins = await sb.from("dimension_rows").insert(rows.map((r, i) => ({ table_id: tableId, match: r.match, values: r.values, sort_order: i })));
  if (ins.error) return fail(ins.error.message);
  await audit(sb, user.id, "product.dimension_table", "dimension_tables", tableId, { rows: rows.length }); done(productId); return ok({ rows: rows.length });
}
