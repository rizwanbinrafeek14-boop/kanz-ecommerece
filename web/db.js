/* eslint-disable @typescript-eslint/no-require-imports -- plain Node CommonJS script, run with `node db.js` */
// Supabase connection (Hostinger "Connect from your Web App" step 2).
// The website itself connects through src/lib/supabase/*; this file is a standalone client and connection check:
//   node db.js        → prints "Connected" with one category row, or the connection error.
// Settings come from SUPABASE_URL / SUPABASE_API_KEY (Hostinger) or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY;
// only a public (anon / publishable) key is used here — see supabase-env.cjs. Keys are never printed.
const { createClient } = require("@supabase/supabase-js");
const { resolveSupabaseEnv } = require("./supabase-env.cjs");

const env = resolveSupabaseEnv();
const supabase = env.url && env.anonKey ? createClient(env.url, env.anonKey, { auth: { persistSession: false } }) : null;

// Test the connection (only when run directly, not when imported)
if (require.main === module) {
  if (!supabase) {
    console.error("Connection error: Supabase is not configured.", env.notes.join(" "));
    process.exitCode = 1;
  } else {
    supabase
      .from("categories")
      .select("slug, name_en")
      .limit(1)
      .then(({ data, error }) => {
        if (error) { console.error("Connection error:", error.message); process.exitCode = 1; }
        else console.log("Connected:", data);
      });
  }
}

module.exports = supabase;
