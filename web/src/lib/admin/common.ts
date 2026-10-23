import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string): Result<never> => ({ ok: false, error });

/** Make storefront pages reflect an admin change right away. */
export function refreshStorefront() { revalidatePath("/", "layout"); }

export async function audit(sb: SupabaseClient, actor: string, action: string, entity: string, entityId?: string, detail?: unknown) {
  await sb.from("audit_log").insert({ actor, action, entity, entity_id: entityId ?? null, detail: detail ?? null });
}

/** Returns `base`, `base-2`, `base-3`… whichever is not yet used in `table.slug`. */
export async function uniqueSlug(sb: SupabaseClient, table: "products" | "categories" | "brands", base: string, excludeId?: string) {
  const root = slugify(base) || "item";
  const { data } = await sb.from(table).select("id, slug").like("slug", `${root}%`);
  const used = new Set((data ?? []).filter((r: { id: string }) => r.id !== excludeId).map((r: { slug: string }) => r.slug));
  if (!used.has(root)) return root;
  for (let i = 2; i < 500; i++) if (!used.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now()}`;
}

export const emptyToNull = (v: FormDataEntryValue | null | undefined): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
export const num = (v: FormDataEntryValue | null | undefined): number | null => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
export const bool = (v: FormDataEntryValue | null | undefined) => v === "on" || v === "true" || v === "1";
