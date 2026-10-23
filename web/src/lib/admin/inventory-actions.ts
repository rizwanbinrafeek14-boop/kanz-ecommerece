"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, refreshStorefront, type Result } from "./common";

const moveSchema = z.object({
  variantId: z.string().uuid(), warehouseId: z.string().uuid(), type: z.enum(["stock_in", "stock_out", "adjustment"]),
  quantity: z.number().min(0).max(100_000_000), unitCost: z.number().min(0).max(100_000_000).nullable(), reason: z.string().trim().max(300).nullable(), reference: z.string().trim().max(100).nullable(),
});
/** All stock changes go through the staff_stock_apply() database function: atomic, locked, and written to the movement ledger. */
export async function stockMove(input: z.input<typeof moveSchema>): Promise<Result> {
  await requireStaff();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid quantity.");
  const d = parsed.data;
  if (d.type !== "adjustment" && d.quantity <= 0) return fail("Quantity must be greater than zero.");
  if (d.type === "adjustment" && !d.reason) return fail("Adjustments need a reason (e.g. stocktake, damaged goods).");
  const sb = await createClient();
  const { error } = await sb.rpc("staff_stock_apply", { p_variant: d.variantId, p_warehouse: d.warehouseId, p_type: d.type, p_qty: d.quantity, p_unit_cost: d.unitCost, p_reason: d.reason, p_reference: d.reference });
  if (error) return fail(error.message);
  revalidatePath("/admin/inventory"); revalidatePath("/admin"); refreshStorefront();
  return ok(null);
}

export async function setReorderLevel(variantId: string, warehouseId: string, level: number): Promise<Result> {
  await requireStaff();
  if (!(level >= 0) || level > 100_000_000) return fail("Enter a valid level.");
  const sb = await createClient();
  const { error } = await sb.from("stock_levels").upsert({ variant_id: variantId, warehouse_id: warehouseId, reorder_level: level }, { onConflict: "variant_id,warehouse_id", ignoreDuplicates: false });
  if (error) return fail(error.message);
  revalidatePath("/admin/inventory");
  return ok(null);
}

const whSchema = z.object({ code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, "Code: letters, numbers, - and _"), name: z.string().trim().min(1).max(100), city: z.string().trim().max(100).nullable(), is_default: z.boolean(), is_active: z.boolean() });
export async function saveWarehouse(id: string | null, input: z.input<typeof whSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = whSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const sb = await createClient(); const d = parsed.data;
  if (d.is_default) await sb.from("warehouses").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  const { error } = id ? await sb.from("warehouses").update(d).eq("id", id) : await sb.from("warehouses").insert(d);
  if (error) return fail(error.code === "23505" ? "That warehouse code already exists." : error.message);
  revalidatePath("/admin/inventory");
  return ok(null);
}
export async function deleteWarehouse(id: string): Promise<Result> {
  await requireAdmin(); const sb = await createClient();
  const { error } = await sb.from("warehouses").delete().eq("id", id);
  if (error) return fail(error.code === "23503" ? "This warehouse has stock history. Deactivate it instead." : error.message);
  revalidatePath("/admin/inventory");
  return ok(null);
}
