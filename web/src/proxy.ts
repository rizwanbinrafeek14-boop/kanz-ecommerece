import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";
import { canonicalRedirect } from "@/lib/canonical-host";

const PUBLIC_FILE = /\.(.*)$/;

/** True when the Accept header ranks text/markdown above text/html (q-values respected; equal rank: Markdown wins if listed first). */
function prefersMarkdown(accept: string | null) {
  if (!accept || !/text\/markdown/i.test(accept)) return false;
  const q = (type: string) => { const parts = accept.split(",").map((x) => x.trim().toLowerCase());
    const i = parts.findIndex((x) => x.split(";")[0].trim() === type); if (i < 0) return { q: -1, i: 999 };
    const m = parts[i].match(/;\s*q=([\d.]+)/); return { q: m ? Number(m[1]) : 1, i }; };
  const md = q("text/markdown"), html = q("text/html");
  return md.q > html.q || (md.q === html.q && md.i < html.i);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. One canonical address: https + the configured host (e.g. non-www -> www), permanent redirect.
  const canon = canonicalRedirect(request.url, request.headers.get("host"), request.headers.get("x-forwarded-proto"), process.env.NEXT_PUBLIC_SITE_URL);
  if (canon) return NextResponse.redirect(canon, 308);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isApi = pathname.startsWith("/api/");
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  // paths for AI agents: Markdown pages, the MCP server, well-known files (llms.txt / robots.txt contain a dot)
  const isAgent = pathname === "/md" || pathname.startsWith("/md/") || pathname === "/mcp" || pathname.startsWith("/.well-known/");
  if (isAgent) return NextResponse.next();

  // 0b. An agent asking for Markdown (Accept: text/markdown preferred over HTML) gets the Markdown version of a catalogue page.
  if (request.method === "GET" && !isAdmin && !isApi && prefersMarkdown(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = `/md${hasLocale ? pathname : `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`}`;
    const res = NextResponse.rewrite(url); res.headers.set("Vary", "Accept"); return res;
  }

  // 1. Locale routing for storefront paths: / -> /en or /ar (cookie, then Accept-Language)
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
  // storefront pages also answer with Markdown for "Accept: text/markdown" (above), so shared caches must key on Accept
  const vary = (r: NextResponse) => { if (!isAdmin && !isApi) r.headers.append("Vary", "Accept"); return r; };
  vary(response);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  // Only where the server reads the session: admin, APIs, sign-in callbacks, account / checkout / RFQ pages and server actions
  // (POST). Catalogue pages are public and cached; checking the session there cost a Supabase round trip on every page view
  // and link prefetch for signed-in visitors. The browser keeps its own session fresh.
  const needsSession = isAdmin || isApi || pathname.startsWith("/auth/") || request.method === "POST"
    || /^\/(en|ar)\/(account|checkout|rfq)(\/|$)/.test(pathname);
  if (!needsSession) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = vary(NextResponse.next({ request }));
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
