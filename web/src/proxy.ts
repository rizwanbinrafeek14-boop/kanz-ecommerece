import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { canonicalRedirect } from "@/lib/canonical-host";

const PUBLIC_FILE = /\.(.*)$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. One canonical address: https + the configured host (e.g. non-www -> www), permanent redirect.
  const canon = canonicalRedirect(request.url, request.headers.get("host"), request.headers.get("x-forwarded-proto"), process.env.NEXT_PUBLIC_SITE_URL);
  if (canon) return NextResponse.redirect(canon, 308);

  // 1. Locale routing for storefront paths: / -> /en or /ar (cookie, then Accept-Language)
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isApi = pathname.startsWith("/api/");
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!isAdmin && !isApi && !hasLocale && !PUBLIC_FILE.test(pathname) && !pathname.startsWith("/auth/")) {
    const cookieLang = request.cookies.get("kanz_lang")?.value;
    const accept = request.headers.get("accept-language") ?? "";
    const lang = LOCALES.find((l) => l === cookieLang) ?? (/^ar/i.test(accept) ? "ar" : DEFAULT_LOCALE);
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2. Keep the Supabase session fresh (only if configured) and do an optimistic admin check.
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (isAdmin && pathname !== "/admin/login" && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|favicon|icon|robots.txt|sitemap.xml).*)"],
};
