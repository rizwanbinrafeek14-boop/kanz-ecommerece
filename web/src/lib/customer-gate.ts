import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Datasheets are for signed-in customers. Returns null when allowed, otherwise a redirect to sign-in that comes back to the product page. */
export async function requireSignedIn(req: Request, productSlug: string | null): Promise<NextResponse | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user) return null;
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const back = productSlug && /^[a-z0-9-]{1,200}$/.test(productSlug) ? `/${lang}/product/${productSlug}` : `/${lang}`;
  return NextResponse.redirect(new URL(`/${lang}/account/login?reason=datasheet&next=${encodeURIComponent(back)}`, url.origin), { status: 303, headers: { "cache-control": "private, no-store" } });
}
