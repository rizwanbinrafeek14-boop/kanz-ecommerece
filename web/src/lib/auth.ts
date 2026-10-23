import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "staff" | "admin";
export interface SessionUser { id: string; email: string | undefined; role: Role; fullName: string | null }

/** Returns the signed-in user with their DB role, or null. Uses getUser() (verifies the JWT with Supabase). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name, is_active").eq("id", user.id).single();
  if (!profile || !profile.is_active) return null;
  return { id: user.id, email: user.email, role: profile.role as Role, fullName: profile.full_name };
}

/** Server-side gate for every admin page and action. Never rely on UI hiding or the proxy alone. */
export async function requireStaff(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  if (u.role !== "staff" && u.role !== "admin") redirect("/admin/login?error=forbidden");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireStaff();
  if (u.role !== "admin") redirect("/admin?error=admin-only");
  return u;
}

export async function requireCustomer(lang: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/${lang}/account/login`);
  return u;
}
