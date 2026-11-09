import { llmsTxt } from "@/lib/agent/content";

export const revalidate = 3600;
/** llms.txt (llmstxt.org): a short, link-rich summary of the site for language models and agents. */
export async function GET() {
  return new Response(await llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } });
}
