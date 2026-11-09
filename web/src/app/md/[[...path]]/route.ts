import { brandMarkdown, homeMarkdown, listingMarkdown, productMarkdown, type Lang } from "@/lib/agent/content";

export const revalidate = 60;
const md = (body: string, status = 200) => new Response(body, { status, headers: {
  "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", "x-robots-tag": "noindex", vary: "Accept",
} });
const SLUG = /^[a-z0-9-]{1,200}$/;

/**
 * Markdown versions of the public catalogue pages, for AI agents: /md/en, /md/en/products?q=…, /md/en/category/<slug>,
 * /md/en/product/<slug>, /md/en/brand/<slug>. The same paths without /md return them too when requested with
 * "Accept: text/markdown" (see proxy.ts). Not indexed by search engines (the HTML pages are the canonical ones).
 */
export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const [lang0 = "en", kind, slug, ...rest] = (await params).path ?? [];
  const lang: Lang = lang0 === "ar" ? "ar" : "en";
  if ((lang0 !== "en" && lang0 !== "ar") || rest.length) return md("# Not found\n\nTry /md/en, /md/en/products?q=…, /md/en/category/<slug> or /md/en/product/<slug>.\n", 404);
  const sp = new URL(req.url).searchParams; const page = Number(sp.get("page")) || 1;
  if (!kind) return md(await homeMarkdown(lang));
  if (kind === "products" && !slug) return md(await listingMarkdown(lang, { q: sp.get("q") ?? undefined, category: sp.get("category") ?? undefined, page }));
  if (slug && SLUG.test(slug)) {
    if (kind === "category") return md(await listingMarkdown(lang, { category: slug, page }));
    if (kind === "product") { const body = await productMarkdown(lang, slug); if (body) return md(body); }
    if (kind === "brand") { const body = await brandMarkdown(lang, slug); if (body) return md(body); }
  }
  return md(`# Not found\n\nNo Markdown version of this page. Start at /md/${lang}.\n`, 404);
}
