import "server-only";
/**
 * The admin quotation list's filters, shared by the list page and its export.
 * owner: "" any · "me" · "none" (unassigned) · a staff id. status: "" any · "open" (submitted / under review) · one status.
 * age: "" · "24" / "48" / "168" = open and received more than that many hours ago. sort: "new" (default) · "old".
 */
import { createClient } from "@/lib/supabase/server";

export const RFQ_STATUSES = ["submitted", "under_review", "quoted", "accepted", "rejected", "expired", "converted", "cancelled"] as const;
export const OPEN = ["submitted", "under_review"] as const;
export interface RfqFilter { q?: string; status?: string; owner?: string; age?: string; sort?: string }
export const ageHours = (createdAt: string, now = Date.now()) => (now - new Date(createdAt).getTime()) / 3_600_000;

export function rfqListQuery(sb: Awaited<ReturnType<typeof createClient>>, f: RfqFilter, me: string, columns: string) {
  let q = sb.from("rfqs").select(columns, { count: "exact" });
  if (f.status === "open") q = q.in("status", [...OPEN]);
  else if (f.status && (RFQ_STATUSES as readonly string[]).includes(f.status)) q = q.eq("status", f.status as "submitted");
  if (f.owner === "me") q = q.eq("assigned_to", me);
  else if (f.owner === "none") q = q.is("assigned_to", null);
  else if (f.owner && /^[0-9a-f-]{36}$/i.test(f.owner)) q = q.eq("assigned_to", f.owner);
  const hours = Number(f.age);
  if ([24, 48, 168].includes(hours)) q = q.in("status", [...OPEN]).lt("created_at", new Date(Date.now() - hours * 3_600_000).toISOString());
  if (f.q) { const t = f.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`rfq_number.ilike.%${t}%,contact_name.ilike.%${t}%,company_name.ilike.%${t}%,contact_email.ilike.%${t}%`); }
  return q.order("created_at", { ascending: f.sort === "old" });
}

/** Active staff, for owner pickers. */
export async function staffList(sb: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await sb.from("profiles").select("id, full_name, role").in("role", ["staff", "admin"]).eq("is_active", true).order("full_name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string | null) || "Unnamed staff member" }));
}
