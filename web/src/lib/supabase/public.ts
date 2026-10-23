import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less anonymous client for public catalogue reads. Because it does not touch cookies,
 * pages using it can be statically generated and revalidated (ISR). RLS limits it to published data.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
