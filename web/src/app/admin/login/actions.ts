"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function adminSignIn(_: unknown, fd: FormData): Promise<{ error: string } | null> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const sb = await createClient();
  const { data, error } = await sb.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Incorrect email or password." };
  const { data: p } = await sb.from("profiles").select("role, is_active").eq("id", data.user.id).single();
  if (!p?.is_active || (p.role !== "staff" && p.role !== "admin")) {
    await sb.auth.signOut();
    return { error: "This account does not have admin access." };
  }
  redirect("/admin");
}

export async function adminSignOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}
