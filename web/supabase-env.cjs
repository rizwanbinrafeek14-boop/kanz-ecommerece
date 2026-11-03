// Supabase connection settings from either naming scheme:
//  - this app's own:      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//  - Hostinger's Supabase integration: SUPABASE_URL, SUPABASE_API_KEY
// SUPABASE_API_KEY is used by the website (and therefore sent to browsers) ONLY when it is a public key
// (sb_publishable_… or a JWT with role "anon"). A secret key (sb_secret_… or role "service_role") is only ever
// used on the server, as the service-role key, and never exposed.
"use strict";

/** "public", "secret" or "unknown" for a Supabase API key, without ever printing it. */
function keyKind(key) {
  if (!key) return "unknown";
  if (key.startsWith("sb_publishable_")) return "public";
  if (key.startsWith("sb_secret_")) return "secret";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const role = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role;
      if (role === "anon") return "public";
      if (role === "service_role") return "secret";
    } catch { /* not a JWT */ }
  }
  return "unknown";
}

function resolveSupabaseEnv(env = process.env) {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim() || null;
  const hostingerKey = (env.SUPABASE_API_KEY || "").trim() || null;
  const kind = keyKind(hostingerKey);
  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim() || (kind === "public" ? hostingerKey : null);
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || (kind === "secret" ? hostingerKey : null);
  const notes = [];
  if (!url) notes.push("No Supabase URL: set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
  if (!anonKey) notes.push(kind === "secret"
    ? "SUPABASE_API_KEY is a secret key: it is used on the server only. Also set the public (anon / publishable) key as NEXT_PUBLIC_SUPABASE_ANON_KEY."
    : "No public Supabase key: set NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_API_KEY with the anon / publishable key).");
  if (hostingerKey && kind === "unknown") notes.push("SUPABASE_API_KEY is not a recognised Supabase key and was ignored.");
  return { url, anonKey, serviceKey, notes };
}

module.exports = { resolveSupabaseEnv, keyKind };
