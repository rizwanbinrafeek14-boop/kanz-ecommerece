import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * PRIVILEGED client (bypasses RLS). Never import this from a client component or use it for
 * customer-triggered requests. It is only used by admin-only server actions that re-check the
 * caller's role first (e.g. inviting a staff member).
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
