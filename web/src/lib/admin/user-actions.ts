"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { audit, fail, ok, type Result } from "./common";

export async function setUserRole(userId: string, role: "customer" | "staff" | "admin", active: boolean): Promise<Result> {
  const me = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success || !["customer", "staff", "admin"].includes(role)) return fail("Invalid request.");
  const sb = await createClient();
  if (userId === me.id && (role !== "admin" || !active)) return fail("You cannot remove your own admin access. Ask another admin.");
  if (role !== "admin" || !active) {   // never leave the shop without an active admin
    const { count } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true).neq("id", userId);
    if (!count) return fail("At least one active administrator is required.");
  }
  const { error } = await sb.from("profiles").update({ role, is_active: active }).eq("id", userId);
  if (error) return fail(error.message);
  await audit(sb, me.id, "user.role", "profiles", userId, { role, active });
  revalidatePath("/admin/users");
  return ok(null);
}

/** Invite a new staff member by email. Uses the service-role key on the server only, after re-checking the caller is an admin. */
export async function inviteStaff(email: string, role: "staff" | "admin", fullName: string): Promise<Result> {
  const me = await requireAdmin();
  const e = z.string().trim().toLowerCase().email().safeParse(email);
  if (!e.success) return fail("Enter a valid email address.");
  let svc; try { svc = createServiceClient(); } catch { return fail("The server is missing SUPABASE_SERVICE_ROLE_KEY, so invitations are unavailable. Add it in Vercel → Environment Variables, or create the user in Supabase → Authentication and set the role here."); }
  const { data, error } = await svc.auth.admin.inviteUserByEmail(e.data, { data: { full_name: fullName.trim().slice(0, 120) }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?next=/admin` });
  if (error || !data.user) return fail(error?.message ?? "Invitation failed.");
  const sb = await createClient();
  const { error: ue } = await sb.from("profiles").update({ role, full_name: fullName.trim() || null }).eq("id", data.user.id);
  if (ue) return fail(`Invitation sent, but setting the role failed: ${ue.message}`);
  await audit(sb, me.id, "user.invite", "profiles", data.user.id, { role });
  revalidatePath("/admin/users");
  return ok(null);
}
