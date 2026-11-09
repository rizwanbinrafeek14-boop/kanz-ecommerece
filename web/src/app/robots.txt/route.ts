import { siteUrl } from "@/lib/seo";

/**
 * robots.txt with a Content-Signal line (contentsignals.org): search engines may index the site, AI agents may use pages to
 * answer a user's question (ai-input, e.g. finding a product to quote), but the content may not be used to train models.
 * Change CONTENT_SIGNAL to alter that policy. robots.txt only guides well-behaved crawlers; it is not a security control
 * (admin and account pages are protected by login and also marked noindex).
 */
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";
const DISALLOW = ["/admin", "/api/", "/auth/", "/en/account", "/ar/account", "/en/checkout", "/ar/checkout", "/en/cart", "/ar/cart"];

export function GET() {
  const base = siteUrl();
  const body = [
    "# KANZ CORNER EST. — https://www.kanzcorner.com", "# Content signals: search = may appear in search results; ai-input = may be used to answer questions in real time;",
    "# ai-train = may be used to train or fine-tune AI models. See https://contentsignals.org/", "",
    "User-agent: *", `Content-Signal: ${CONTENT_SIGNAL}`, "Allow: /", ...DISALLOW.map((d) => `Disallow: ${d}`),
    "Allow: /api/datasheet/", "Allow: /api/product/", "",
    `Sitemap: ${base}/sitemap.xml`, `# Site summary for language models: ${base}/llms.txt`, "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
