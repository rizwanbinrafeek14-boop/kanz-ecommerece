import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the link in Supabase confirmation / password-reset emails.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/en/account";
  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${/^\/(en|ar)\//.test(next) && !next.includes("//") && !/[\\\s]/.test(next) ? next : "/en/account"}`);
  }
  return NextResponse.redirect(`${origin}/en/account/login?error=link`);
}
